import { Navigate } from "react-router-dom";
import { useHrSession } from "@/hooks/use-hr-session";

/**
 * Guards staff-facing routes (e.g. /dashboard). Requires an authenticated
 * session. Unauthenticated users are redirected to /login.
 *
 * useHrSession initialises synchronously from the store, so `session` is
 * already known on the first render — no loading state is needed.
 */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const hr = useHrSession();

  if (!hr.session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
