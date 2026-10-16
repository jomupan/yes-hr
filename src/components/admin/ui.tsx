import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  highlight?: boolean;
  sub?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  highlight,
  sub,
}: StatCardProps) {
  return (
    <div
      className={[
        "rounded-[12px] border p-4 sm:p-5 transition-all duration-200 hover:-translate-y-0.5",
        highlight
          ? "bg-amber-500/10 border-amber-500/30 hover:border-amber-500/50"
          : "bg-[#111726] border-white/10 hover:border-white/20",
      ].join(" ")}
    >
      <div className="flex items-center justify-between mb-3">
        <div
          className={[
            "w-9 h-9 rounded-lg flex items-center justify-center",
            highlight
              ? "bg-amber-500/20 text-amber-300"
              : "bg-white/5 text-slate-300",
          ].join(" ")}
        >
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="font-mono-hr text-[26px] font-semibold text-white leading-none">
        {value}
      </div>
      <div className="text-[12px] text-slate-400 mt-1.5">{label}</div>
      {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    pending: { bg: "rgba(217,119,6,0.15)", color: "#fbbf24" },
    approved: { bg: "rgba(34,197,94,0.15)", color: "#4ade80" },
    rejected: { bg: "rgba(239,68,68,0.15)", color: "#f87171" },
  };
  const s = map[status.toLowerCase()] || map.pending;
  return (
    <span
      className="inline-block px-2.5 py-[3px] rounded-full text-[11px] font-semibold capitalize"
      style={{ background: s.bg, color: s.color }}
    >
      {status}
    </span>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[12px] uppercase tracking-[0.08em] text-slate-400 font-semibold mt-7 mb-3">
      {children}
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-[#111726] border border-white/10 rounded-[12px] ${className}`}
    >
      {children}
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-8 text-center text-slate-500 text-sm">
      {children}
    </div>
  );
}

export function AdminBtn({
  children,
  onClick,
  variant = "primary",
  className = "",
  disabled = false,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger" | "success" | "ghost";
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
}) {
  const variants: Record<string, string> = {
    primary: "bg-amber-500 text-slate-950 hover:bg-amber-400 border-amber-500",
    secondary: "bg-transparent text-slate-200 hover:bg-white/5 border-white/15",
    danger:
      "bg-transparent text-rose-400 hover:bg-rose-500/10 border-rose-500/40",
    success:
      "bg-emerald-500 text-slate-950 hover:bg-emerald-400 border-emerald-500",
    ghost:
      "bg-transparent text-amber-300 hover:text-amber-200 border-transparent",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border text-sm font-semibold transition-colors disabled:opacity-45 disabled:cursor-not-allowed disabled:pointer-events-none ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function AdminInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full px-3 py-2 rounded-lg bg-[#0e1320] border border-white/10 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 ${props.className || ""}`}
    />
  );
}

export function AdminSelect(
  props: React.SelectHTMLAttributes<HTMLSelectElement>,
) {
  return (
    <select
      {...props}
      className={`w-full px-3 py-2 rounded-lg bg-[#0e1320] border border-white/10 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 ${props.className || ""}`}
    />
  );
}

/* Avatar circle with initials, deterministic warm tone. */
export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const palette = ["#b45309", "#92400e", "#a16207", "#78350f", "#9a3412"];
  const h = (name || "?").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const bg = palette[h % palette.length];
  const init = (name || "?")
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div
      className="rounded-full flex items-center justify-center font-bold text-amber-100 flex-shrink-0"
      style={{
        width: size,
        height: size,
        background: bg,
        fontSize: size * 0.38,
      }}
    >
      {init}
    </div>
  );
}
