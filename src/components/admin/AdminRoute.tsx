import { Navigate } from "react-router-dom";
import { useAdminSession } from "@/hooks/use-admin-session";

interface Props {
  children: React.ReactNode;
}

/* Guards /admin/* routes — only logged-in admins may proceed. */
export function AdminRoute({ children }: Props) {
  const session = useAdminSession();
  if (!session.ready) {
    return (
      <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center text-slate-400 text-sm">
        Loading admin portal…
      </div>
    );
  }
  // Not logged in → send to the shared login page.
  if (!session.isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  // Logged in but not an admin → block access, send to staff dashboard.
  if (!session.isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}
