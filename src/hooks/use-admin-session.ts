import { useCallback, useEffect, useState } from "react";
import type { UserProfile } from "@/lib/hr-types";
import {
  getSessionUsername,
  getUser,
  setSession,
  roleOf,
} from "@/lib/hr-store";

export interface UseAdminSession {
  ready: boolean;
  username: string | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  /** True when a user is logged in (regardless of role). */
  isAuthenticated: boolean;
  logout: () => void;
  refresh: () => void;
}

export function useAdminSession(): UseAdminSession {
  const [ready, setReady] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const u = getSessionUsername();
    if (u) {
      const p = getUser(u);
      setUsername(u);
      setProfile(p || null);
    } else {
      setUsername(null);
      setProfile(null);
    }
    setReady(true);
  }, [tick]);

  const logout = useCallback(() => {
    setSession(null);
    setUsername(null);
    setProfile(null);
  }, []);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  return {
    ready,
    username,
    profile,
    // Resolve the role through roleOf() so both the new authRole field and
    // the legacy isAdmin flag are honored — supports multiple admin accounts.
    isAdmin: !!profile && roleOf(profile) === "admin",
    isAuthenticated: !!username && !!profile,
    logout,
    refresh,
  };
}
