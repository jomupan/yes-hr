import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import {
  ADMIN_NAV,
  ADMIN_NAV_GROUPS,
  LOGOUT_ICON,
  YES_EMPIRE_LOGO,
} from "@/lib/admin-constants";
import { useAdminSession } from "@/hooks/use-admin-session";
import { useAdminLeaveApps } from "@/lib/api-hr";
import { initials } from "@/lib/hr-store";
import { AdminNotificationBell } from "@/components/admin/AdminNotificationBell";

interface Props {
  children: React.ReactNode;
}

export function AdminLayout({ children }: Props) {
  const session = useAdminSession();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const pendingCount = useAdminLeaveApps().filter(
    (a) => a.status === "Pending",
  ).length;

  const go = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-4 pt-5 pb-4 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-black/40 border border-amber-500/25 flex items-center justify-center p-1">
            <img
              src={YES_EMPIRE_LOGO}
              alt="YES EMPIRE"
              className="h-full object-contain"
            />
          </div>
          <div>
            <div className="font-mono-hr text-[9px] tracking-[0.14em] uppercase text-amber-400/90">
              YES EMPIRE
            </div>
            <div className="text-white font-bold text-[15px] leading-tight">
              Admin Portal
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {ADMIN_NAV_GROUPS.map((group) => {
          const items = ADMIN_NAV.filter((i) => i.group === group);
          if (items.length === 0) return null;
          return (
            <div key={group}>
              <div className="px-2.5 pb-1.5 text-[9.5px] uppercase tracking-[0.12em] text-slate-500 font-semibold">
                {group}
              </div>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const active = location.pathname === item.path;
                  const Icon = item.icon;
                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => go(item.path)}
                        className={[
                          "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] text-left transition-colors",
                          active
                            ? "bg-amber-500/15 text-amber-300 border border-amber-500/25"
                            : "text-slate-300 hover:bg-white/5 hover:text-white border border-transparent",
                        ].join(" ")}
                      >
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        <span className="flex-1">{item.label}</span>
                        {item.id === "leave-requests" && pendingCount > 0 && (
                          <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold">
                            {pendingCount}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* User + logout */}
      <div className="border-t border-white/10 px-3 py-3">
        <div className="flex items-center gap-2.5 px-2 py-1.5 mb-2">
          <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center text-[13px] font-bold flex-shrink-0">
            {session.profile ? initials(session.profile.fullName) : "AD"}
          </div>
          <div className="min-w-0">
            <div className="text-[13px] text-white leading-tight truncate">
              {session.profile?.fullName || "Administrator"}
            </div>
            <div className="text-[11px] text-slate-400 truncate">
              Administrator
            </div>
          </div>
        </div>
        <button
          onClick={() => {
            session.logout();
            navigate("/login");
          }}
          className="w-full flex items-center justify-center gap-2 px-2.5 py-2 text-[12.5px] rounded-lg border border-white/15 text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
        >
          <LOGOUT_ICON className="w-3.5 h-3.5" />
          Log out
        </button>
      </div>
    </div>
  );

  const pageTitle =
    ADMIN_NAV.find((i) => i.path === location.pathname)?.label ||
    "Admin Dashboard";

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-200">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-[240px] flex-col bg-[#0e1320] border-r border-white/10 z-30">
        {sidebarContent}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-[260px] bg-[#0e1320] border-r border-white/10">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-3 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="md:pl-[240px]">
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex items-center justify-between gap-4 px-4 sm:px-6 h-16 bg-[#0b0f19]/85 backdrop-blur-xl border-b border-white/10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden text-slate-300 hover:text-white"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-base sm:text-lg font-bold text-white">
              {pageTitle}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {session.username && (
              <AdminNotificationBell username={session.username} />
            )}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center text-[13px] font-bold">
                {session.profile ? initials(session.profile.fullName) : "AD"}
              </div>
              <div className="hidden sm:block text-right leading-tight">
                <div className="text-[13px] text-white">
                  {session.profile?.fullName || "Admin"}
                </div>
                <div className="text-[10px] text-slate-400">Administrator</div>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="px-4 sm:px-6 py-6 max-w-[1200px] mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
