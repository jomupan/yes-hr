/* Phone notifications (Web Push) for the logged-in user.
 *
 * Android: works in Chrome (installed app or browser).
 * iPhone/iPad: only after "Add to Home Screen" (iOS 16.4+), opened from the
 * home-screen icon. Each phone must say "Allow" once. */

import { api } from "./api";

export type PushState =
  | "unsupported" // this browser can't do it
  | "needs-install" // iPhone in Safari: add to Home Screen first
  | "server-off" // server has no keys yet
  | "blocked" // user pressed "Don't Allow"; must change in phone settings
  | "off"
  | "on";

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches ||
  (navigator as unknown as { standalone?: boolean }).standalone === true;

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  return (await navigator.serviceWorker.getRegistration()) || null;
}

export async function getPushState(): Promise<PushState> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return isIOS() && !isStandalone() ? "needs-install" : "unsupported";
  }
  if (isIOS() && !isStandalone()) return "needs-install";
  const key = await api<{ enabled: boolean }>("/me/push/key").catch(() => ({ enabled: false }));
  if (!key.enabled) return "server-off";
  if (Notification.permission === "denied") return "blocked";
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "on" : "off";
}

/** Ask permission (must be called from a tap) and register this phone. */
export async function enablePush(): Promise<PushState> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "blocked" : "off";
  const { publicKey } = await api<{ publicKey: string | null }>("/me/push/key");
  if (!publicKey) return "server-off";
  const reg = (await registration()) || (await navigator.serviceWorker.register("/sw.js"));
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });
  }
  await api("/me/push/subscribe", { body: sub.toJSON() });
  return "on";
}

export async function disablePush(): Promise<PushState> {
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await api("/me/push/unsubscribe", { body: { endpoint: sub.endpoint } }).catch(() => undefined);
    await sub.unsubscribe().catch(() => undefined);
  }
  return "off";
}

/** After login, re-link this phone to whoever is logged in now (the same
 *  phone may have been used by someone else). Quietly does nothing if
 *  notifications aren't on. */
export async function refreshPushOwner(): Promise<void> {
  try {
    if (!("serviceWorker" in navigator) || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    const reg = await registration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) await api("/me/push/subscribe", { body: sub.toJSON() });
  } catch {
    /* not important */
  }
}
