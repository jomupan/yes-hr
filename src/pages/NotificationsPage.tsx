import { Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { StaffPortal } from "@/components/StaffPortal";
import { useHrSession } from "@/hooks/use-hr-session";
import { roleOf } from "@/lib/hr-store";

/**
 * /notifications route — the staff notifications view. Admins are redirected
 * to their admin dashboard (notifications are staff-facing only).
 */
export function NotificationsPage() {
  const hr = useHrSession();

  if (hr.session && roleOf(hr.session.profile) === "admin") {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return (
    <ProtectedRoute>
      <StaffPortal initialModule="notifications" />
    </ProtectedRoute>
  );
}
