#!/usr/bin/env bash
# YES HR: rebuild and restart after uploading a newer version of the project.
# Your data (/opt/yeshr/data) and settings (/opt/yeshr/.env) are kept.
#     sudo bash deploy/update.sh
set -euo pipefail
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[ "$(id -u)" -eq 0 ] || { echo "Please run with sudo."; exit 1; }
[ -f /opt/yeshr/.env ] || { echo "Run deploy/oracle-setup.sh first."; exit 1; }

echo "==> Backing up the database..."
mkdir -p /opt/yeshr/backups
tar -czf "/opt/yeshr/backups/data-$(date +%Y%m%d-%H%M%S).tar.gz" -C /opt/yeshr data
# Keep the newest 10 backups (names are date-stamped, so sorting by name works).
find /opt/yeshr/backups -name "data-*.tar.gz" | sort -r | tail -n +11 | xargs -r rm -f

echo "==> Building the new version..."
docker build -t yeshr "$APP_DIR"

echo "==> Restarting..."
docker rm -f yeshr >/dev/null 2>&1 || true
docker run -d --name yeshr --restart unless-stopped \
  --env-file /opt/yeshr/.env -v /opt/yeshr/data:/data -p 127.0.0.1:8080:8080 yeshr >/dev/null

for _ in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:8080/api/health >/dev/null 2>&1; then echo "==> Updated and running."; exit 0; fi
  sleep 2
done
docker logs --tail 40 yeshr
echo "The new version didn't start. The lines above show why."
exit 1
