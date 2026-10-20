/* Small client for the YES Elevate backend (backend/ folder).
 *
 * In development Vite forwards every /api request to the backend on
 * http://localhost:4000 (see vite.config.ts), so the default base "/api"
 * works with no extra setup. Set VITE_API_URL to point somewhere else,
 * e.g. VITE_API_URL=https://hr.example.com/api for a deployed backend. */

import type { UserProfile, UserRole } from "./hr-types";

export const API_BASE: string =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "/api";

const TOKEN_KEY = "hr:token";

/* Where the login token lives:
 *  - sessionStorage (default): gone when the app/browser is closed, so the
 *    next open starts at the login page. Right for shared devices.
 *  - localStorage ("Remember me" ticked): stays logged in on this device. */
function store(kind: "session" | "local"): Storage | null {
  try {
    return kind === "session" ? sessionStorage : localStorage;
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  return store("session")?.getItem(TOKEN_KEY) ?? store("local")?.getItem(TOKEN_KEY) ?? null;
}

/** Username this page is showing (the app's session record). */
function sessionUsername(): string {
  try {
    return (JSON.parse(store("local")?.getItem("hr:session") || "{}") as { username?: string }).username || "";
  } catch {
    return "";
  }
}

/** Headers for an authenticated request. X-HR-User tells the server which
 *  account this screen belongs to, so if another tab has since logged in as
 *  someone else, the server refuses instead of saving to the wrong person. */
export function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const user = sessionUsername();
  if (token && user) headers["X-HR-User"] = user;
  return headers;
}

/** The account changed in another tab: reload so this tab shows the
 *  account that is really logged in. */
export function handleAccountSwitched(code?: string): void {
  if (code === "ACCOUNT_SWITCHED") window.location.reload();
}

/** True when the current login was made with "Remember me". */
export function isRemembered(): boolean {
  return !!store("local")?.getItem(TOKEN_KEY);
}

export function setToken(token: string | null, remember = false): void {
  try {
    store("session")?.removeItem(TOKEN_KEY);
    store("local")?.removeItem(TOKEN_KEY);
    if (token) store(remember ? "local" : "session")?.setItem(TOKEN_KEY, token);
  } catch {
    /* storage unavailable: token lives for this page only */
  }
}

/** Error carrying the backend's readable message + code. */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

const OFFLINE_MESSAGE =
  "Can't reach the server. Make sure the backend is running (npm run dev in the backend folder).";

/** JSON request to the backend. Throws ApiError with the server's message. */
export async function api<T = Record<string, unknown>>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean; checkAccount?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = options.auth !== false ? authHeaders() : {};
  // /auth/me is how a page finds out who is really logged in, so it skips the check.
  if (options.checkAccount === false) delete headers["X-HR-User"];
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: options.method || (options.body !== undefined ? "POST" : "GET"),
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(OFFLINE_MESSAGE, 0, "OFFLINE");
  }

  let data: { ok?: boolean; error?: string; code?: string } & Record<string, unknown>;
  try {
    data = await res.json();
  } catch {
    throw new ApiError(res.ok ? "Unexpected server response." : OFFLINE_MESSAGE, res.status, "BAD_RESPONSE");
  }
  if (!res.ok || data.ok === false) {
    handleAccountSwitched(data.code);
    throw new ApiError(data.error || "Something went wrong.", res.status, data.code);
  }
  return data as T;
}

/** Turn a backend file path (/api/...) into a URL an <img> or link can open. */
export function fileUrl(path: string | null | undefined): string {
  if (!path) return "";
  const base = API_BASE.replace(/\/api$/, "");
  const url = path.startsWith("http") ? path : `${base}${path}`;
  const token = getToken();
  return token ? `${url}${url.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}` : url;
}

/* ---------- typed auth calls ---------- */

/** Profile as returned by the backend (same shape as UserProfile). */
export type ApiProfile = UserProfile & {
  authRole: UserRole;
  accountStatus: "active" | "inactive";
};

export interface ApiSessionBundle {
  username: string;
  profile: ApiProfile;
  authRole: UserRole;
}

export interface AuthResponse {
  token: string;
  session: ApiSessionBundle;
}

export const authApi = {
  login: (identifier: string, password: string, remember = false) =>
    api<AuthResponse>("/auth/login", { body: { identifier, password, remember }, auth: false }),
  register: (body: {
    name: string;
    username: string;
    role: string;
    password: string;
    email: string;
    departmentId: string;
    companyId: string;
  }) => api<AuthResponse>("/auth/register", { body, auth: false }),
  me: () => api<{ session: ApiSessionBundle }>("/auth/me", { checkAccount: false }),
  forgotPassword: (identifier: string) =>
    api<{ message: string; devToken?: string; resetUrl?: string }>("/auth/forgot-password", {
      body: { identifier },
      auth: false,
    }),
  checkResetToken: (token: string) =>
    api<{ valid: boolean }>(`/auth/reset-password/${encodeURIComponent(token)}`, { auth: false }),
  resetPassword: (token: string, newPassword: string) =>
    api("/auth/reset-password", { body: { token, newPassword }, auth: false }),
};
