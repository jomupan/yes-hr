/* Bridges backend logins with the browser store the rest of the app reads.
 *
 * Login, registration and password reset now go through the backend. The
 * other modules (attendance, leave, claims, ...) still read the browser
 * store, so after a successful server login we copy the server's profile
 * into that store. As each module moves to the API, it stops depending on
 * this copy. */

import type { UserProfile } from "./hr-types";
import { authApi, ApiError, getToken, setToken, type AuthResponse, type ApiSessionBundle } from "./api";
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
export function startServerSession(res: AuthResponse): void {
  setToken(res.token);
  syncProfile(res.session);
  setSession(res.session.username);
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
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) setSession(null);
  }
}
