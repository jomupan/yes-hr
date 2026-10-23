import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { AdminInput } from "@/components/admin/ui";
import { getAdminEmployees } from "@/lib/admin-store";
import { isAccountActive } from "@/lib/account-status";
import { useAdminDirectory } from "@/lib/api-admin";

/** Active staff (not admins) for pick lists. */
export function useActiveStaff() {
  const directory = useAdminDirectory();
  return useMemo(
    () =>
      getAdminEmployees()
        .filter((e) => e.profile.authRole !== "admin" && !e.profile.isAdmin && isAccountActive(e.profile))
        .map((e) => ({ username: e.username, fullName: e.profile.fullName }))
        .sort((a, b) => a.fullName.localeCompare(b.fullName)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [directory],
  );
}

/** Tick-box list of staff with search and "tick all". */
export function StaffChecklist({
  staff,
  selected,
  onChange,
  title,
}: {
  staff: { username: string; fullName: string }[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  title: string;
}) {
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const shown = staff.filter((s) => !q || s.fullName.toLowerCase().includes(q) || s.username.includes(q));
  const allTicked = staff.length > 0 && staff.every((s) => selected.has(s.username));
  const toggle = (u: string) => {
    const next = new Set(selected);
    if (next.has(u)) next.delete(u);
    else next.add(u);
    onChange(next);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] uppercase tracking-wide text-slate-500">
          {title} ({selected.size} of {staff.length})
        </span>
        <button
          type="button"
          onClick={() => onChange(allTicked ? new Set() : new Set(staff.map((s) => s.username)))}
          className="text-[12px] text-amber-300 hover:text-amber-200"
        >
          {allTicked ? "Untick all" : "Tick all staff"}
        </button>
      </div>
      <div className="relative mb-2">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <AdminInput placeholder="Search staff" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>
      <div className="border border-white/10 rounded-lg max-h-[220px] overflow-y-auto divide-y divide-white/5">
        {shown.length === 0 ? (
          <div className="px-3 py-4 text-[12.5px] text-slate-500 text-center">
            {staff.length === 0 ? "No active staff yet." : "No staff match your search."}
          </div>
        ) : (
          shown.map((s) => (
            <label key={s.username} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-white/[0.03]">
              <input
                type="checkbox"
                checked={selected.has(s.username)}
                onChange={() => toggle(s.username)}
                className="w-4 h-4 accent-amber-500"
              />
              <span className="text-[13px] text-slate-200">{s.fullName}</span>
              <span className="text-[11.5px] text-slate-500 ml-auto">{s.username}</span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}
