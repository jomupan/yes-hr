import { useCallback, useMemo, useState } from "react";
import type {
  AttendanceData,
  ClaimData,
  DopeData,
  DopeStatus,
  EvalData,
  LeaveData,
  UserProfile,
  UserRole,
} from "@/lib/hr-types";
import {
  ensureSeedUsers,
  getAttendance,
  getClaim,
  getDope,
  getDopeStatus,
  getEval,
  getLeave,
  getSessionUsername,
  getUser,
  getUserIndex,
  roleOf,
  setJSON,
  setSession,
  todayISO,
  nowISO,
  validatePassword,
} from "@/lib/hr-store";
import { notifyAdminStaffRegistered } from "@/lib/notification-store";
import { isAccountActive } from "@/lib/account-status";
import { authApi } from "@/lib/api";
import { hasServerSession, startServerSession, syncServerRecords } from "@/lib/api-session";

export type View = "landing" | "login" | "register" | "dopegate" | "app";

export interface HrSession {
  username: string;
  profile: UserProfile;
  dope: DopeData;
  attendance: AttendanceData;
  leave: LeaveData;
  claim: ClaimData;
  evaluation: EvalData;
  status: DopeStatus;
  isAdmin: boolean;
  authRole: UserRole;
}

export interface UseHrSession {
  view: View;
  session: HrSession | null;
  authError: string;
  regError: string;
  /** Legacy username-only login (kept for backward compatibility). */
  login: (username: string) => string | null;
  /** Credential login used by the new login form. Returns the role on success. */
  loginWithCredentials: (
    identifier: string,
    password: string,
  ) => Promise<UserRole | null>;
  register: (
    name: string,
    username: string,
    role: string,
    password: string,
    email: string,
    departmentId: string,
    companyId: string,
  ) => Promise<string | null>;
  logout: () => void;
  goToRegister: () => void;
  goToLogin: () => void;
  goToLanding: () => void;
  refresh: () => void;
  updateDope: (d: DopeData) => void;
  updateAttendance: (a: AttendanceData) => void;
  updateLeave: (l: LeaveData) => void;
  updateClaim: (c: ClaimData) => void;
}

/* ---------- module-level session builder ----------
   Reads synchronously from the store so any hook instance can initialise
   its state in useState (no loading gap, no cross-instance race). */
function buildSession(username: string): HrSession | null {
  const profile = getUser(username);
  if (!profile) return null;
  // Stale-session guard: an inactive account can never enter the portal.
  if (!isAccountActive(profile)) return null;
  const dope = getDope(username);
  return {
    username,
    profile,
    dope,
    attendance: getAttendance(username),
    leave: getLeave(username),
    claim: getClaim(username),
    evaluation: getEval(username),
    status: getDopeStatus(dope.history),
    isAdmin: !!profile.isAdmin,
    authRole: roleOf(profile),
  };
}

function initialSession(): HrSession | null {
  ensureSeedUsers();
  const u = getSessionUsername();
  // Only a session backed by a server token counts (see lib/api-session.ts).
  if (u && !hasServerSession()) {
    setSession(null);
    return null;
  }
  if (u && getUserIndex().includes(u)) {
    const s = buildSession(u);
    if (s) return s;
    // Account inactive or profile missing — clear the stale session so the
    // user is sent to /login instead of silently keeping portal access.
    setSession(null);
  }
  return null;
}

function viewForSession(s: HrSession | null): View {
  if (!s) return "landing";
  return s.status.state === "first_time" ? "dopegate" : "app";
}

export function useHrSession(): UseHrSession {
  // Synchronous init — every instance starts with the correct state on the
  // very first render, so children never see a transient null session.
  const [session, setSessionState] = useState<HrSession | null>(initialSession);
  const [view, setView] = useState<View>(() => viewForSession(session));
  const [authError, setAuthError] = useState("");
  const [regError, setRegError] = useState("");

  const applySession = useCallback((s: HrSession | null) => {
    setSessionState(s);
    setView(viewForSession(s));
  }, []);

  const login = useCallback(
    (username: string): string | null => {
      const u = username.trim().toLowerCase();
      if (!u) {
        setAuthError("Please enter a username.");
        return null;
      }
      const index = getUserIndex();
      if (!index.includes(u)) {
        setAuthError("Username not found. Please register first.");
        return null;
      }
      if (!isAccountActive(getUser(u))) {
        setAuthError(
          "This account is no longer active. Please contact HR for assistance.",
        );
        return null;
      }
      setAuthError("");
      setSession(u);
      applySession(buildSession(u));
      return null;
    },
    [applySession],
  );

  const loginWithCredentials = useCallback(
    async (identifier: string, password: string): Promise<UserRole | null> => {
      if (!identifier.trim() || !password) {
        setAuthError("Invalid email, Staff ID, or password.");
        return null;
      }
      try {
        // The backend checks the password, account status and role.
        const res = await authApi.login(identifier.trim(), password);
        startServerSession(res);
        await syncServerRecords(res.session.username);
      } catch (e) {
        setAuthError(e instanceof Error ? e.message : "Unable to log in.");
        return null;
      }
      setAuthError("");
      const s = buildSession(getSessionUsername() || "");
      if (!s) {
        setAuthError("Invalid email, Staff ID, or password.");
        return null;
      }
      applySession(s);
      return s.authRole;
    },
    [applySession],
  );

  const register = useCallback(
    async (
      name: string,
      username: string,
      role: string,
      password: string,
      email: string,
      departmentId: string,
      companyId: string,
    ): Promise<string | null> => {
      const cleanName = name.trim();
      const cleanUser = username.trim().toLowerCase().replace(/\s+/g, ".");
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanName || !cleanUser) {
        setRegError("Please complete your name and username.");
        return null;
      }
      if (!companyId) {
        setRegError("Please select your company.");
        return null;
      }
      if (!departmentId) {
        setRegError("Please select your department.");
        return null;
      }
      const pwCheck = validatePassword(password);
      if (!pwCheck.ok) {
        setRegError(pwCheck.errors[0]);
        return null;
      }
      // The backend re-checks everything above, plus duplicate username /
      // email and that the department belongs to the company, then creates
      // the account (always as staff) and notifies the admins.
      try {
        const res = await authApi.register({
          name: cleanName,
          username: cleanUser,
          role,
          password,
          email: cleanEmail,
          departmentId,
          companyId,
        });
        startServerSession(res);
        await syncServerRecords(res.session.username);
        // Keep the admin bell in this browser in step until notifications
        // move to the API too.
        notifyAdminStaffRegistered(cleanName, res.session.username);
        setRegError("");
        const s = buildSession(res.session.username);
        if (s) {
          // New users must complete the personality test.
          setSessionState(s);
          setView("dopegate");
        }
      } catch (e) {
        setRegError(e instanceof Error ? e.message : "Unable to complete registration.");
      }
      return null;
    },
    [],
  );

  const logout = useCallback(() => {
    setSession(null);
    setAuthError("");
    applySession(null);
  }, [applySession]);

  const goToRegister = useCallback(() => {
    setView("register");
    setRegError("");
  }, []);

  const goToLogin = useCallback(() => {
    setView("login");
    setAuthError("");
  }, []);

  const goToLanding = useCallback(() => {
    setView("landing");
  }, []);

  const refresh = useCallback(() => {
    if (!session) return;
    setSessionState(buildSession(session.username));
  }, [session]);

  const updateDope = useCallback(
    (d: DopeData) => {
      if (!session) return;
      setJSON(`hr:dopetest:${session.username}`, d);
      // Use applySession so `view` is recomputed from the new status.
      // Once the test is completed the status becomes "valid" and the view
      // flips from "dopegate" to "app" — otherwise the gate view gets stuck
      // and the Staff Portal sidebar navigation appears unresponsive.
      applySession(buildSession(session.username));
    },
    [session, applySession],
  );

  const updateAttendance = useCallback(
    (a: AttendanceData) => {
      if (!session) return;
      setJSON(`hr:attendance:${session.username}`, a);
      setSessionState(buildSession(session.username));
    },
    [session],
  );

  const updateLeave = useCallback(
    (l: LeaveData) => {
      if (!session) return;
      setJSON(`hr:leave:${session.username}`, l);
      setSessionState(buildSession(session.username));
    },
    [session],
  );

  const updateClaim = useCallback(
    (c: ClaimData) => {
      if (!session) return;
      setJSON(`hr:claim:${session.username}`, c);
      setSessionState(buildSession(session.username));
    },
    [session],
  );

  return useMemo(
    () => ({
      view,
      session,
      authError,
      regError,
      login,
      loginWithCredentials,
      register,
      logout,
      goToRegister,
      goToLogin,
      goToLanding,
      refresh,
      updateDope,
      updateAttendance,
      updateLeave,
      updateClaim,
    }),
    [
      view,
      session,
      authError,
      regError,
      login,
      loginWithCredentials,
      register,
      logout,
      goToRegister,
      goToLogin,
      goToLanding,
      refresh,
      updateDope,
      updateAttendance,
      updateLeave,
      updateClaim,
    ],
  );
}

// Re-export helpers used by components
export { todayISO, nowISO };
