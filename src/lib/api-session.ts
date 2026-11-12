/* Bridges backend logins with the browser store the rest of the app reads.
 *
 * Login, registration and password reset go through the backend. The staff
 * screens read a browser copy of the user's records, which is refreshed from
 * the server at login, at app start and after every change. */

import type { UserProfile } from "./hr-types";
import { authApi, ApiError, getToken, isRemembered, setToken, type AuthResponse, type ApiSessionBundle } from "./api";
import { syncMyAttendance } from "./api-attendance";
import { syncMyHrRecords } from "./api-hr";
import { refreshPushOwner } from "./push";
import { getSessionUsername, getUser, getUserIndex, setJSON, setSession, setUserIndex } from "./hr-store";

/** Write the server's profile into the local store (keeps local-only fields). */
export function syncProfile(bundle: ApiSessionBundle): void {
  const { username, profile } = bundle;
  const existing = getUser(username) || ({} as Partial<UserProfile>);
  const merged: UserProfile = {
    ...existing,
    ...profile,
    username,
    companyId: profile.companyId ?? undefined,
    departmentId: profile.departmentId ?? undefined,
  };
  // Passwords live only on the server now.
  delete merged.passwordHash;
  setJSON(`hr:user:${username}`, merged);
  const index = getUserIndex();
  if (!index.includes(username)) setUserIndex([...index, username]);
}

/** Save the token + profile from a login/register response and start the session. */
export function startServerSession(res: AuthResponse, remember = false): void {
  setToken(res.token, remember);
  syncProfile(res.session);
  setSession(res.session.username);
  markActive();
  pageAccount = currentAccount();
  // If this phone has notifications on, link it to the person who just logged in.
  void refreshPushOwner();
}

/* ---------- one account per device ----------
   All tabs (and an installed app sharing the browser) use the same saved
   login. If another tab logs in as someone else, this tab reloads so it
   never shows one person's name with another person's records. */
let pageAccount = "";
const currentAccount = () => `${getSessionUsername() || ""}|${getToken() || ""}`;

export function installAccountWatch(): void {
  pageAccount = currentAccount();
  const check = () => {
    const now = currentAccount();
    if (now === pageAccount) return;
    // Logged out here or elsewhere: nothing to show, go to the login page.
    if (!getSessionUsername()) {
      pageAccount = now;
      if (!window.location.pathname.startsWith("/login")) window.location.replace("/login");
      return;
    }
    window.location.reload();
  };
  window.addEventListener("storage", (e) => {
    if (e.key === null || e.key === "hr:token" || e.key === "hr:session") check();
  });
  window.addEventListener("focus", check);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") check();
  });
}

/* ---------- automatic logout after inactivity ----------
   For logins without "Remember me": if the app sits unused (or in the
   background on a phone) for IDLE_LIMIT_MS, the next touch sends the user
   back to the login page. */
const IDLE_LIMIT_MS = 30 * 60 * 1000;
const LAST_ACTIVE_KEY = "hr:lastActive";

function markActive(): void {
  try {
    sessionStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

function idleTooLong(): boolean {
  if (!getToken() || isRemembered()) return false;
  try {
    const last = Number(sessionStorage.getItem(LAST_ACTIVE_KEY) || 0);
    return last > 0 && Date.now() - last > IDLE_LIMIT_MS;
  } catch {
    return false;
  }
}

function logoutForIdle(): void {
  setSession(null);
  window.location.replace("/login?reason=idle");
}

/** Call once at startup. Watches for activity and logs out idle sessions. */
export function installIdleLogout(): void {
  if (idleTooLong()) {
    setSession(null);
    return; // main.tsx renders; the login page shows the "logged out" note
  }
  let lastWrite = 0;
  const onActivity = () => {
    if (idleTooLong()) return logoutForIdle();
    const now = Date.now();
    if (now - lastWrite > 15_000) {
      lastWrite = now;
      markActive();
    }
  };
  for (const ev of ["pointerdown", "keydown", "scroll", "touchstart"]) {
    window.addEventListener(ev, onActivity, { passive: true });
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") onActivity();
  });
  window.setInterval(() => {
    if (idleTooLong()) logoutForIdle();
  }, 60_000);
}

/** Pull the user's records from the server into the browser store the
 *  staff screens read (attendance, leave, claims, personality test,
 *  evaluations). Failures are ignored, so a slow or offline server never
 *  blocks logging in. */
export async function syncServerRecords(username: string): Promise<void> {
  await Promise.all([
    syncMyAttendance(username).catch(() => undefined),
    syncMyHrRecords(username),
  ]);
}

/** True when a token is stored for the current browser session. */
export function hasServerSession(): boolean {
  return !!getToken() && !!getSessionUsername();
}

/**
 * Run once on app start, before the first render:
 *  - an old demo session without a server token is cleared (log in again);
 *  - a stored token is checked with the backend, refreshing the profile so
 *    role/status changes made by an admin apply right away;
 *  - an expired token or deactivated account logs the user out.
 * If the backend can't be reached, the stored session is kept as is.
 */
export async function verifyStoredSession(): Promise<void> {
  const username = getSessionUsername();
  const token = getToken();
  if (!username && !token) return;
  if (!token || !username) {
    setSession(null);
    return;
  }
  try {
    const { session } = await authApi.me();
    if (session.username !== username) setSession(session.username);
    syncProfile(session);
    await syncServerRecords(session.username);
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) setSession(null);
  }
}
