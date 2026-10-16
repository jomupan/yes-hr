import { Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { StaffPortal } from "@/components/StaffPortal";
import { useHrSession } from "@/hooks/use-hr-session";
import { roleOf } from "@/lib/hr-store";

/**
 * /dashboard route — the Staff Portal home for authenticated staff users.
 * Admins who land here are redirected to their admin dashboard.
 */
export function DashboardPage() {
  const hr = useHrSession();

  if (hr.session && roleOf(hr.session.profile) === "admin") {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return (
    <ProtectedRoute>
      <StaffPortal />
    </ProtectedRoute>
  );
}
