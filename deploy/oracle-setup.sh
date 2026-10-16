#!/usr/bin/env bash
# YES HR: one-time setup on an Oracle Cloud "Always Free" Ubuntu server.
#
# Run from inside the uploaded project folder:
#     sudo bash deploy/oracle-setup.sh
#
# What it does:
#   1. Installs Docker (runs the app) and Caddy (free HTTPS).
#   2. Opens ports 80/443 in the server's firewall.
#   3. Adds swap memory on small servers so the build doesn't run out of RAM.
#   4. Creates /opt/yeshr/.env with a random JWT secret and your admin password.
#   5. Builds the app and runs it with automatic restart (also after reboot).
#   6. Gives it an https:// address using sslip.io (no domain needed).
# Safe to run again: it keeps your data and existing settings.
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR=/opt/yeshr/data
ENV_FILE=/opt/yeshr/.env
IMAGE=yeshr
CONTAINER=yeshr

say()  { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || fail "Please run with sudo:  sudo bash deploy/oracle-setup.sh"
[ -f "$APP_DIR/Dockerfile" ] || fail "Dockerfile not found. Run this from inside the uploaded yeselevatesystem folder."

# ---------- 1. Packages ----------
say "Installing Docker and Caddy (a few minutes)..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y docker.io caddy curl openssl iptables-persistent
apt-get install -y docker-buildx 2>/dev/null || true   # newer builder, if available
systemctl enable --now docker

# ---------- 2. Firewall ----------
# Oracle's Ubuntu images block everything except SSH in iptables.
say "Opening web ports 80 and 443..."
for port in 80 443; do
  if ! iptables -C INPUT -p tcp --dport "$port" -m conntrack --ctstate NEW -j ACCEPT 2>/dev/null; then
    iptables -I INPUT 1 -p tcp --dport "$port" -m conntrack --ctstate NEW -j ACCEPT
  fi
done
netfilter-persistent save >/dev/null 2>&1 || iptables-save > /etc/iptables/rules.v4

# ---------- 3. Swap on small servers ----------
MEM_MB=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
if [ "$MEM_MB" -lt 3000 ] && ! swapon --show | grep -q /swapfile; then
  say "Small server (${MEM_MB} MB RAM): adding 4 GB swap so the build fits..."
  fallocate -l 4G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=4096
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# ---------- 4. Settings ----------
mkdir -p "$DATA_DIR"
if [ ! -f "$ENV_FILE" ]; then
  say "Choose the admin password for the online app"
  echo "Rules: 8+ characters, with an UPPERCASE letter, a lowercase letter and a number."
  echo "(Nothing appears on screen while you type. That's normal.)"
  while true; do
    read -r -s -p "Admin password: " PW1; echo
    read -r -s -p "Type it again:  " PW2; echo
    if [ "$PW1" != "$PW2" ]; then echo "They don't match, try again."; continue; fi
    if [ ${#PW1} -lt 8 ] || ! [[ "$PW1" =~ [A-Z] ]] || ! [[ "$PW1" =~ [a-z] ]] || ! [[ "$PW1" =~ [0-9] ]]; then
      echo "Too weak: needs 8+ characters with uppercase, lowercase and a number."; continue
    fi
    break
  done
  umask 077
  {
    echo "JWT_SECRET=$(openssl rand -hex 32)"
    echo "SEED_ADMIN_PASSWORD=$PW1"
    echo "APP_TIMEZONE=Asia/Kuala_Lumpur"
  } > "$ENV_FILE"
  unset PW1 PW2
  echo "Saved to $ENV_FILE (readable by root only)."
else
  say "Keeping existing settings in $ENV_FILE"
fi

# ---------- 5. Build + run ----------
say "Building the app (5-15 minutes the first time)..."
docker build -t "$IMAGE" "$APP_DIR"

say "Starting the app..."
docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
docker run -d --name "$CONTAINER" --restart unless-stopped \
  --env-file "$ENV_FILE" \
  -v "$DATA_DIR":/data \
  -p 127.0.0.1:8080:8080 \
  "$IMAGE" >/dev/null

echo -n "Waiting for the app to start"
for i in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:8080/api/health >/dev/null 2>&1; then echo " ok"; break; fi
  echo -n "."; sleep 2
  if [ "$i" -eq 60 ]; then echo; docker logs --tail 40 "$CONTAINER"; fail "The app didn't start. The lines above show why."; fi
done

# ---------- 6. HTTPS address ----------
PUBLIC_IP=$(curl -fsS https://api.ipify.org || curl -fsS https://ifconfig.me || true)
[ -n "$PUBLIC_IP" ] || fail "Couldn't detect this server's public IP address."
HOST="${PUBLIC_IP//./-}.sslip.io"

say "Setting up HTTPS for https://$HOST ..."
cat > /etc/caddy/Caddyfile <<CADDY
$HOST {
	encode gzip
	reverse_proxy 127.0.0.1:8080
}
CADDY
systemctl enable caddy >/dev/null 2>&1 || true
systemctl restart caddy

echo -n "Getting the HTTPS certificate"
for _ in $(seq 1 30); do
  if curl -fsS "https://$HOST/api/health" >/dev/null 2>&1; then echo " ok"; OK=1; break; fi
  echo -n "."; sleep 3
done

echo
if [ "${OK:-0}" = "1" ]; then
  printf '\033[1;32m%s\033[0m\n' "YES HR is live:  https://$HOST"
  echo "Log in as:  admin  (with the password you just chose)"
else
  echo "The app is running, but HTTPS isn't reachable from the internet yet."
  echo "Most likely the Oracle network rule for ports 80/443 is missing"
  echo "(Console > Networking > your VCN > Security Lists > Add Ingress Rules)."
  echo "After adding it, run:  sudo systemctl restart caddy"
  echo "Then open:  https://$HOST"
fi
echo
echo "Useful commands:"
echo "  sudo docker logs -f yeshr        # see what the app is doing (Ctrl+C to exit)"
echo "  sudo bash deploy/update.sh       # after uploading a newer version of the project"
