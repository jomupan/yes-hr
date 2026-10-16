import { Navigate } from "react-router-dom";
import { useHrSession } from "@/hooks/use-hr-session";
import { AuthCard } from "@/components/hr/AuthCard";
import { roleOf } from "@/lib/hr-store";

/**
 * /login route — renders the shared login form. If a session already exists,
 * redirect to the role-appropriate home.
 */
export function LoginPage() {
  const hr = useHrSession();

  if (hr.session) {
    return (
      <Navigate
        to={
          roleOf(hr.session.profile) === "admin"
            ? "/admin/dashboard"
            : "/dashboard"
        }
        replace
      />
    );
  }

  // AuthCard renders LoginCard for any view other than "register".
  return <AuthCard hr={hr} />;
}
