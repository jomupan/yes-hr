import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ModuleId } from "@/lib/hr-types";
import { MODULES } from "@/lib/hr-constants";
import { initials } from "@/lib/hr-store";
import type { UseHrSession } from "@/hooks/use-hr-session";
import { NotificationBell } from "@/components/hr/NotificationBell";

interface Props {
  hr: UseHrSession;
  activeModule: ModuleId;
  onSelect: (id: ModuleId) => void;
  children: React.ReactNode;
}

export function AppShell({ hr, activeModule, onSelect, children }: Props) {
  const navigate = useNavigate();
  const session = hr.session!;
  const status = session.status;
  const gated = status.state === "first_time";
  // Phones: the sidebar becomes a slide-in menu (laptops keep it fixed).
  const [menuOpen, setMenuOpen] = useState(false);
  const activeLabel = MODULES.find((m) => m.id === activeModule)?.label ?? "Staff Portal";

  // Close the menu with the Escape key.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const handleLogout = () => {
    hr.logout();
    navigate("/login");
  };

  const select = (id: ModuleId) => {
    setMenuOpen(false);
    onSelect(id);
  };

  return (
    <div className="flex min-h-screen">
      {/* Phone top bar */}
      <header
        className="md:hidden fixed top-0 inset-x-0 z-30 flex items-center gap-2 px-3 h-14 border-b border-white/10"
        style={{
          background: "hsl(var(--ink))",
          color: "#EDEFF3",
          paddingTop: "env(safe-area-inset-top)",
          height: "calc(3.5rem + env(safe-area-inset-top))",
        }}
      >
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          aria-expanded={menuOpen}
          className="w-10 h-10 -ml-1 flex items-center justify-center rounded-lg hover:bg-white/10"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
        <div className="flex-1 min-w-0 text-[15px] font-semibold text-white truncate">
          {activeLabel}
        </div>
      </header>

      {/* Dimmed backdrop behind the open menu (phones only) */}
      {menuOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/45"
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={[
          "w-[230px] flex-shrink-0 flex flex-col p-[14px] pt-[22px]",
          // Phones: off-canvas drawer. Laptops (md+): normal sidebar.
          "fixed inset-y-0 left-0 z-50 overflow-y-auto transition-transform duration-200",
          menuOpen ? "translate-x-0" : "-translate-x-full",
          "md:static md:translate-x-0 md:z-auto md:overflow-visible",
        ].join(" ")}
        style={{
          background: "hsl(var(--ink))",
          color: "#EDEFF3",
          paddingTop: "max(22px, env(safe-area-inset-top))",
        }}
      >
        <div className="px-2 pb-4 border-b border-white/12 mb-3.5 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <img
              src="https://vibe.filesafe.space/1786075267723187770/attachments/4e504305-8d67-43cf-b05f-f75e9736b640.webp"
              alt="YES EMPIRE"
              className="h-6 object-contain"
            />
          </div>
          <div>
            <div className="font-mono-hr text-[9px] tracking-[0.14em] uppercase text-[hsl(var(--blue-light))]">
              HR System &middot; YES EMPIRE
            </div>
            <h1 className="text-[17px] text-white font-bold leading-tight">
              Staff Portal
            </h1>
          </div>
        </div>
        <ul className="list-none m-0 p-0 flex-1">
          {MODULES.map((m) => {
            // Hide admin module for non-admin users
            if (m.id === "admin" && !session.isAdmin) return null;
            // During first-time gate, only dashboard is accessible
            const disabled =
              gated && m.id !== "dashboard" && m.id !== "dopetest";
            const active = activeModule === m.id;
            return (
              <li key={m.id} className="mb-0.5">
                <button
                  disabled={disabled}
                  onClick={() => !disabled && select(m.id)}
                  className={[
                    "flex items-center gap-2.5 w-full text-left px-2.5 py-2 rounded-lg border-none text-[13.5px] transition-colors",
                    active
                      ? "text-white"
                      : "text-[#C9CEDA] hover:bg-white/6 hover:text-white",
                    disabled
                      ? "opacity-35 cursor-not-allowed"
                      : "cursor-pointer",
                  ].join(" ")}
                  style={
                    active ? { background: "hsl(var(--blue))" } : undefined
                  }
                >
                  <span className="font-mono-hr text-[11px] text-[#7B8499] w-4">
                    {m.num}
                  </span>
                  <span>{m.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="border-t border-white/12 pt-3 mt-2">
          <div className="flex items-center gap-2.5 px-2 py-1.5 pb-2.5">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold flex-shrink-0"
              style={{
                background: "hsl(var(--blue-light))",
                color: "hsl(var(--blue-dark))",
              }}
            >
              {initials(session.profile.fullName)}
            </div>
            <div>
              <div className="text-[13px] text-white leading-tight">
                {session.profile.fullName}
              </div>
              <div className="text-[11px] text-[#96A0B4]">
                {session.profile.role}
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full px-2.5 py-2 text-[12.5px] rounded-lg border border-white/15 bg-transparent text-[#C9CEDA] cursor-pointer hover:bg-white/6 hover:text-white transition-colors"
          >
            Log out
          </button>
        </div>
      </aside>
      <main
        className="flex-1 min-w-0 px-4 pt-[calc(4.25rem+env(safe-area-inset-top))] pb-[60px] md:p-7 md:pb-[60px] max-w-[980px]"
      >
        <div className="flex justify-end mb-2 max-md:fixed max-md:top-[calc(0.5rem+env(safe-area-inset-top))] max-md:right-3 max-md:z-30 max-md:mb-0">
          <NotificationBell username={session.username} onNavigate={select} />
        </div>
        {children}
      </main>
    </div>
  );
}
