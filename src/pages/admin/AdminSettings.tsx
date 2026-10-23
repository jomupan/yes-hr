import { useState } from "react";
import { Save, ShieldCheck } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, AdminBtn, AdminInput } from "@/components/admin/ui";
import { useAdminSession } from "@/hooks/use-admin-session";
import { ReplacementLeaveCard } from "@/components/admin/ReplacementLeaveCard";

export function AdminSettings() {
  const session = useAdminSession();
  const [companyName, setCompanyName] = useState("YES Empire Group");
  const [defaultAnnual, setDefaultAnnual] = useState("14");
  const [defaultMedical, setDefaultMedical] = useState("14");
  const [defaultEmergency, setDefaultEmergency] = useState("3");
  const [saved, setSaved] = useState(false);

  const save = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <AdminLayout>
      <div className="mb-5">
        <h2 className="text-xl sm:text-2xl font-bold text-white">Settings</h2>
        <p className="text-slate-400 text-sm mt-1">
          Configure organization and leave policy defaults.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-white mb-4">
            Organization
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">
                Company Name
              </label>
              <AdminInput
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">
                Administrator
              </label>
              <AdminInput
                value={session.profile?.fullName || "Administrator"}
                disabled
              />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-white mb-4">
            Default Leave Balances
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">
                Annual
              </label>
              <AdminInput
                type="number"
                value={defaultAnnual}
                onChange={(e) => setDefaultAnnual(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">
                Medical
              </label>
              <AdminInput
                type="number"
                value={defaultMedical}
                onChange={(e) => setDefaultMedical(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">
                Emergency
              </label>
              <AdminInput
                type="number"
                value={defaultEmergency}
                onChange={(e) => setDefaultEmergency(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-5 flex items-center gap-3">
            <AdminBtn variant="primary" onClick={save}>
              <Save className="w-4 h-4" /> Save Changes
            </AdminBtn>
            {saved && (
              <span className="text-[12px] text-emerald-400">
                Settings saved.
              </span>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-4">
        <ReplacementLeaveCard />
      </div>

      <div className="mt-4">
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-300 flex-shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Admin Access</h3>
              <p className="text-[12px] text-slate-400 mt-1 leading-relaxed">
                Only users with the administrator role can access this portal.
                Public registration only ever creates staff accounts. Admin
                accounts are managed by authorized administrators from the Admin
                Accounts page.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
}
