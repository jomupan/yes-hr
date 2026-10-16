import { Navigate } from "react-router-dom";
import { useHrSession } from "@/hooks/use-hr-session";
import { LandingPage } from "@/components/hr/LandingPage";
import { AuthCard } from "@/components/hr/AuthCard";
import { StaffPortal } from "@/components/StaffPortal";
import { roleOf } from "@/lib/hr-store";

const Index = () => {
  const hr = useHrSession();

  // Not authenticated yet.
  if (!hr.session) {
    if (hr.view === "login" || hr.view === "register") {
      return <AuthCard hr={hr} />;
    }
    return <LandingPage hr={hr} />;
  }

  // Authenticated — send users to their role-appropriate home.
  if (roleOf(hr.session.profile) === "admin") {
    return <Navigate to="/admin/dashboard" replace />;
  }
  return <Navigate to="/dashboard" replace />;
};

export default Index;
