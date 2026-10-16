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

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
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
  options: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  const token = getToken();
  if (options.auth !== false && token) headers.Authorization = `Bearer ${token}`;

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
  login: (identifier: string, password: string) =>
    api<AuthResponse>("/auth/login", { body: { identifier, password }, auth: false }),
  register: (body: {
    name: string;
    username: string;
    role: string;
    password: string;
    email: string;
    departmentId: string;
    companyId: string;
  }) => api<AuthResponse>("/auth/register", { body, auth: false }),
  me: () => api<{ session: ApiSessionBundle }>("/auth/me"),
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
