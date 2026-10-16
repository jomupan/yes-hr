import { useState } from "react";
import type { UseHrSession } from "@/hooks/use-hr-session";
import type { DopeResult, UserProfile } from "@/lib/hr-types";
import { getAllUsers } from "@/lib/hr-store";
import { DOPE_PERSONALITY_TYPES } from "@/lib/hr-constants";
import { downloadDopeResult } from "@/lib/dope-download";
import { fmtDate } from "@/lib/hr-store";

interface Props {
  hr: UseHrSession;
}

export function AdminPanel({ hr }: Props) {
  const session = hr.session!;
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [selectedResult, setSelectedResult] = useState<DopeResult | null>(null);
  const users = getAllUsers();

  const currentUser = users.find((u) => u.username === selectedUser);

  return (
    <>
      <div className="flex items-start justify-between gap-5 mb-[22px]">
        <div>
          <h1 className="text-2xl">Admin Panel</h1>
          <div className="text-muted-foreground text-[13.5px] mt-1">
            View Dope Personality Test results for all staff. Administrator
            access only.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mb-5">
        <div className="bg-card border border-border rounded-[10px] p-4">
          <div className="text-[11.5px] text-muted-foreground uppercase tracking-[0.05em]">
            Total Staff
          </div>
          <div className="font-mono-hr font-semibold text-[22px] mt-1.5">
            {users.length}
          </div>
        </div>
        <div className="bg-card border border-border rounded-[10px] p-4">
          <div className="text-[11.5px] text-muted-foreground uppercase tracking-[0.05em]">
            Staff Tested
          </div>
          <div className="font-mono-hr font-semibold text-[22px] mt-1.5">
            {users.filter((u) => u.dope.history.length > 0).length}
          </div>
        </div>
      </div>

      <div className="text-[13px] uppercase tracking-[0.06em] text-muted-foreground mt-[26px] mb-2.5">
        Staff List & Test Results
      </div>
      <div className="bg-card border border-border rounded-[10px] overflow-hidden shadow-[0_1px_2px_rgba(22,35,59,0.06),0_2px_10px_rgba(22,35,59,0.05)]">
        <table className="w-full border-collapse text-[13.5px]">
          <thead>
            <tr>
              <th className="text-left text-[11px] uppercase tracking-[0.04em] text-muted-foreground px-4 py-2.5 border-b border-border">
                Staff
              </th>
              <th className="text-left text-[11px] uppercase tracking-[0.04em] text-muted-foreground px-4 py-2.5 border-b border-border">
                Position
              </th>
              <th className="text-left text-[11px] uppercase tracking-[0.04em] text-muted-foreground px-4 py-2.5 border-b border-border">
                Tests Taken
              </th>
              <th className="text-left text-[11px] uppercase tracking-[0.04em] text-muted-foreground px-4 py-2.5 border-b border-border">
                Latest Test
              </th>
              <th className="text-left text-[11px] uppercase tracking-[0.04em] text-muted-foreground px-4 py-2.5 border-b border-border">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-6 text-center text-muted-foreground"
                >
                  No staff registered.
                </td>
              </tr>
            )}
            {users.map((u) => {
              const latest = [...u.dope.history].sort(
                (a, b) =>
                  new Date(b.date).getTime() - new Date(a.date).getTime(),
              )[0];
              return (
                <tr key={u.username}>
                  <td className="px-4 py-2.5 border-b border-border last:border-b-0">
                    <div className="font-medium">{u.profile.fullName}</div>
                    <div className="text-xs text-muted-foreground font-mono-hr">
                      {u.username}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 border-b border-border last:border-b-0">
                    {u.profile.role}
                  </td>
                  <td className="px-4 py-2.5 border-b border-border last:border-b-0 font-mono-hr">
                    {u.dope.history.length}
                  </td>
                  <td className="px-4 py-2.5 border-b border-border last:border-b-0">
                    {latest ? (
                      <div>
                        <div className="font-mono-hr text-xs">
                          {fmtDate(latest.date)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {DOPE_PERSONALITY_TYPES[latest.personalityType]
                            ?.label || latest.personalityType}
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">
                        Not tested
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 border-b border-border last:border-b-0">
                    <button
                      onClick={() => {
                        setSelectedUser(u.username);
                        setSelectedResult(null);
                      }}
                      disabled={u.dope.history.length === 0}
                      className="text-[hsl(var(--blue))] text-xs underline hover:opacity-70 disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
                    >
                      View results
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Detail modal for selected user */}
      {currentUser && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-5"
          style={{ background: "rgba(22,35,59,0.45)" }}
          onClick={() => {
            setSelectedUser(null);
            setSelectedResult(null);
          }}
        >
          <div
            className="bg-white rounded-[14px] max-w-[520px] w-full p-6 shadow-lg max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold">
                  {currentUser.profile.fullName}
                </h3>
                <div className="text-xs text-muted-foreground">
                  {currentUser.profile.role} &middot; {currentUser.username}
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedUser(null);
                  setSelectedResult(null);
                }}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                Close ✕
              </button>
            </div>

            {selectedResult ? (
              <ResultDetail
                profile={currentUser.profile}
                result={selectedResult}
                onBack={() => setSelectedResult(null)}
              />
            ) : (
              <>
                <div className="text-[13px] uppercase tracking-[0.06em] text-muted-foreground mb-2.5">
                  Dope Personality Test History
                </div>
                {currentUser.dope.history.length === 0 ? (
                  <div className="text-center text-muted-foreground py-6 text-sm">
                    This staff member has not taken any tests yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {[...currentUser.dope.history]
                      .sort(
                        (a, b) =>
                          new Date(b.date).getTime() -
                          new Date(a.date).getTime(),
                      )
                      .map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center justify-between p-3 rounded-lg border border-border bg-[hsl(var(--paper))]"
                        >
                          <div>
                            <div className="font-mono-hr text-xs">
                              {fmtDate(r.date)}
                            </div>
                            <div className="text-sm font-medium">
                              {DOPE_PERSONALITY_TYPES[r.personalityType]
                                ?.label || r.personalityType}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setSelectedResult(r)}
                              className="text-[hsl(var(--blue))] text-xs underline hover:opacity-70"
                            >
                              View
                            </button>
                            <button
                              onClick={() =>
                                downloadDopeResult(currentUser.profile, r)
                              }
                              className="text-[hsl(var(--blue))] text-xs underline hover:opacity-70"
                            >
                              Download
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ResultDetail({
  profile,
  result,
  onBack,
}: {
  profile: UserProfile;
  result: DopeResult;
  onBack: () => void;
}) {
  const typeMeta = DOPE_PERSONALITY_TYPES[result.personalityType];
  return (
    <div>
      <button
        onClick={onBack}
        className="text-xs text-muted-foreground hover:text-foreground mb-3"
      >
        ← Back to list
      </button>
      <div className="flex items-center gap-2 mb-3">
        <span className="inline-block px-2.5 py-[3px] rounded-full text-[11px] font-semibold bg-[hsl(var(--green-pale))] text-[hsl(var(--green))]">
          Passed
        </span>
        <span className="font-mono-hr text-xs text-muted-foreground">
          {fmtDate(result.date)}
        </span>
      </div>
      <h4 className="text-[16px] font-bold mb-1.5">
        {typeMeta?.label || result.personalityType}
      </h4>
      <p className="text-sm text-muted-foreground leading-relaxed mb-4">
        {result.summary || typeMeta?.summary}
      </p>
      <div className="text-[13px] uppercase tracking-[0.06em] text-muted-foreground mb-2.5">
        Trait Scores
      </div>
      {Object.entries(result.scores).map(([trait, score]) => {
        const max = 15;
        const pct = Math.min(100, (score / max) * 100);
        return (
          <div key={trait} className="flex items-center gap-2.5 mb-2.5">
            <div className="text-[13px] w-[140px] flex-shrink-0">{trait}</div>
            <div className="flex-1 h-2 rounded-full bg-[hsl(var(--paper-2))] overflow-hidden">
              <div
                className="h-full rounded-full bg-[hsl(var(--blue))]"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="w-8 text-right font-mono-hr text-[12.5px] font-semibold">
              {score}
            </div>
          </div>
        );
      })}
      <button
        onClick={() => downloadDopeResult(profile, result)}
        className="mt-4 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-[hsl(var(--ink))] bg-[hsl(var(--ink))] text-white text-sm font-semibold hover:bg-[hsl(var(--blue-dark))] hover:border-[hsl(var(--blue-dark))] transition-colors"
      >
        Download Test Result
      </button>
    </div>
  );
}
