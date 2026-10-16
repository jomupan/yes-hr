import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ModuleId } from "@/lib/hr-types";
import { useHrSession } from "@/hooks/use-hr-session";
import { AppShell } from "@/components/hr/AppShell";
import { DopeTest } from "@/components/hr/DopeTest";
import { Dashboard } from "@/components/hr/Dashboard";
import { Attendance } from "@/components/hr/Attendance";
import { Leave } from "@/components/hr/Leave";
import { Payslip } from "@/components/hr/Payslip";
import { Claim } from "@/components/hr/Claim";
import { Evaluation } from "@/components/hr/Evaluation";
import { CalendarView } from "@/components/hr/Calendar";
import { Notifications } from "@/components/hr/Notifications";

/**
 * The authenticated Staff Portal UI. Reused by the `/` (Index) route and the
 * `/dashboard` route so there is a single source of truth for the staff layout.
 */
interface StaffPortalProps {
  initialModule?: ModuleId;
}

export function StaffPortal({ initialModule = "dashboard" }: StaffPortalProps) {
  const hr = useHrSession();
  const navigate = useNavigate();
  const [activeModule, setActiveModule] = useState<ModuleId>(initialModule);

  const handleSelect = (id: ModuleId) => {
    if (id === "admin") {
      if (hr.session?.isAdmin) navigate("/admin/dashboard");
      return;
    }
    setActiveModule(id);
  };

  // The gate is driven by the live dope status, not the `view` string.
  // `view` is only recomputed when the session changes (login/logout), so
  // relying on it here would leave the gate stuck after the test completes
  // and make the sidebar navigation appear dead.
  const gated = hr.session?.status.state === "first_time";

  const renderModule = () => {
    switch (activeModule) {
      case "dashboard":
        return <Dashboard hr={hr} onNavigate={handleSelect} />;
      case "attendance":
        return <Attendance hr={hr} />;
      case "leave":
        return <Leave hr={hr} />;
      case "payslip":
        return <Payslip hr={hr} />;
      case "claim":
        return <Claim hr={hr} />;
      case "evaluation":
        return <Evaluation hr={hr} />;
      case "calendar":
        return <CalendarView hr={hr} />;
      case "dopetest":
        return <DopeTest hr={hr} />;
      case "notifications":
        return <Notifications hr={hr} onNavigate={handleSelect} />;
      case "admin":
        return <Dashboard hr={hr} onNavigate={handleSelect} />;
      default:
        return <Dashboard hr={hr} onNavigate={handleSelect} />;
    }
  };

  return (
    <AppShell hr={hr} activeModule={activeModule} onSelect={handleSelect}>
      {gated ? <DopeTest hr={hr} forced /> : renderModule()}
    </AppShell>
  );
}
