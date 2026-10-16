import { useState } from "react";
import type { UseHrSession } from "@/hooks/use-hr-session";
import type { DopeAnswer, DopeResult } from "@/lib/hr-types";
import {
  DOPE_DECLARATIONS,
  DOPE_QUESTIONS,
  DOPE_REMINDER_DAYS,
  DOPE_VALID_DAYS,
  DOPE_PERSONALITY_TYPES,
} from "@/lib/hr-constants";
import { buildDopeResult, fmtDate, fmtTime, todayISO } from "@/lib/hr-store";
import { downloadDopeResult } from "@/lib/dope-download";
import { notifyAdminDopeCompleted } from "@/lib/notification-store";

interface Props {
  hr: UseHrSession;
  /** true when rendered as a forced gate inside the shell main area */
  forced?: boolean;
  onComplete?: () => void;
}

type Phase = "intro" | "questions" | "declaration" | "result";

export function DopeTest({ hr, forced, onComplete }: Props) {
  const session = hr.session!;
  const status = session.status;
  const [phase, setPhase] = useState<Phase>("intro");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checks, setChecks] = useState<Record<number, boolean>>({});
  const [latestResult, setLatestResult] = useState<DopeResult | null>(null);

  const history = [...session.dope.history].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  const allAnswered = DOPE_QUESTIONS.every((q) => answers[q.id]);
  const allChecked = DOPE_DECLARATIONS.every((_, i) => checks[i]);

  let headline: string;
  let sub: string;
  if (status.state === "first_time") {
    headline = "Dope Personality Test is required for new staff";
    sub =
      "As a newly registered staff member, you must complete the Dope Personality Test before full access to the HR System is granted.";
  } else if (status.state === "overdue") {
    headline = "Your Dope Personality Test has expired";
    sub = `Your last Dope Personality Test was over ${DOPE_VALID_DAYS} days ago. You can still access the system — please complete this test again at any convenient time.`;
  } else if (status.state === "reminder") {
    headline = "Your Dope Personality Test is expiring soon";
    sub = `Valid for ${status.daysLeft} more days. You can retake the test at any time.`;
  } else {
    headline = "Dope Personality Test";
    sub =
      "You can take this test at any time you wish. Results are saved in your private space.";
  }

  const startTest = () => {
    setAnswers({});
    setChecks({});
    setPhase("questions");
  };

  const submitTest = () => {
    if (!allChecked) return;
    const answerList: DopeAnswer[] = DOPE_QUESTIONS.map((q) => ({
      questionId: q.id,
      optionId: answers[q.id],
    }));
    const result = buildDopeResult(answerList);
    const updated = {
      history: [...session.dope.history, result],
    };
    hr.updateDope(updated);
    setLatestResult(result);
    setPhase("result");
    // Notify admins that a staff member completed the personality test.
    notifyAdminDopeCompleted(session.profile.fullName, result.personalityType);
    onComplete?.();
  };

  /* ---- INTRO ---- */
  if (phase === "intro") {
    return (
      <div className={forced ? "" : "max-w-[640px]"}>
        {!forced && (
          <div className="flex items-start justify-between gap-5 mb-[22px]">
            <h1 className="text-2xl">Dope Personality Test</h1>
          </div>
        )}
        <div
          className="bg-card border border-border rounded-[10px] p-4 mb-5"
          style={{
            boxShadow:
              "0 1px 2px rgba(22,35,59,0.06), 0 2px 10px rgba(22,35,59,0.05)",
          }}
        >
          <div className="font-mono-hr text-[11px] tracking-[0.1em] uppercase text-[hsl(var(--amber))]">
            {status.state === "overdue"
              ? "Expired — Can Be Renewed Anytime"
              : status.state === "first_time"
                ? "Action required"
                : "Voluntary Test"}
          </div>
          <h2 className="mt-1.5 text-[19px]">{headline}</h2>
          <div className="text-muted-foreground text-[13.5px] mt-1.5 leading-relaxed">
            {sub}
          </div>
        </div>

        <div
          className="bg-card border border-border rounded-[10px] p-[18px]"
          style={{
            boxShadow:
              "0 1px 2px rgba(22,35,59,0.06), 0 2px 10px rgba(22,35,59,0.05)",
          }}
        >
          <h3 className="text-[15px] mb-2.5">About This Test</h3>
          <ul className="text-sm text-muted-foreground leading-relaxed list-disc pl-5 space-y-1.5 mb-4">
            <li>
              This test contains {DOPE_QUESTIONS.length} personality questions
              and an integrity declaration.
            </li>
            <li>
              Results are classified into personality types (D, I, S, C, or T).
            </li>
            <li>
              Test results are saved in your private space and can be downloaded
              at any time.
            </li>
            <li>
              Other staff cannot view your results — only you and the system
              administrator.
            </li>
          </ul>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={startTest}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-[hsl(var(--ink))] bg-[hsl(var(--ink))] text-white text-sm font-semibold hover:bg-[hsl(var(--blue-dark))] hover:border-[hsl(var(--blue-dark))] transition-colors"
            >
              {history.length > 0
                ? "Retake Test"
                : "Start Dope Personality Test"}
            </button>
          </div>
          <div className="text-xs text-muted-foreground mt-4 leading-relaxed">
            The Dope Personality Test should be renewed every{" "}
            {Math.round(DOPE_VALID_DAYS / 30.4)} months. The system will send a
            reminder {DOPE_REMINDER_DAYS} days before the expiry date. However,
            you are free to take this test at any time.
          </div>
        </div>

        {history.length > 0 && (
          <>
            <div className="text-[13px] uppercase tracking-[0.06em] text-muted-foreground mt-[26px] mb-2.5">
              Dope Personality Test History
            </div>
            <div className="bg-card border border-border rounded-[10px] overflow-hidden shadow-[0_1px_2px_rgba(22,35,59,0.06),0_2px_10px_rgba(22,35,59,0.05)]">
              <table className="w-full border-collapse text-[13.5px]">
                <thead>
                  <tr>
                    <th className="text-left text-[11px] uppercase tracking-[0.04em] text-muted-foreground px-4 py-2.5 border-b border-border">
                      Date
                    </th>
                    <th className="text-left text-[11px] uppercase tracking-[0.04em] text-muted-foreground px-4 py-2.5 border-b border-border">
                      Personality Type
                    </th>
                    <th className="text-left text-[11px] uppercase tracking-[0.04em] text-muted-foreground px-4 py-2.5 border-b border-border">
                      Status
                    </th>
                    <th className="text-left text-[11px] uppercase tracking-[0.04em] text-muted-foreground px-4 py-2.5 border-b border-border">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-2.5 border-b border-border font-mono-hr last:border-b-0">
                        {fmtDate(h.date)}
                      </td>
                      <td className="px-4 py-2.5 border-b border-border last:border-b-0">
                        {DOPE_PERSONALITY_TYPES[h.personalityType]?.label ||
                          h.personalityType}
                      </td>
                      <td className="px-4 py-2.5 border-b border-border last:border-b-0">
                        <span className="inline-block px-2.5 py-[3px] rounded-full text-[11px] font-semibold bg-[hsl(var(--green-pale))] text-[hsl(var(--green))]">
                          Passed
                        </span>
                      </td>
                      <td className="px-4 py-2.5 border-b border-border last:border-b-0">
                        <button
                          onClick={() => downloadDopeResult(session.profile, h)}
                          className="text-[hsl(var(--blue))] text-xs underline hover:opacity-70"
                        >
                          Download
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    );
  }

  /* ---- QUESTIONS ---- */
  if (phase === "questions") {
    return (
      <div className="max-w-[640px]">
        <div className="flex items-start justify-between gap-5 mb-[22px]">
          <h1 className="text-2xl">Dope Personality Test</h1>
        </div>
        <div
          className="bg-card border border-border rounded-[10px] p-[18px] mb-5"
          style={{
            boxShadow:
              "0 1px 2px rgba(22,35,59,0.06), 0 2px 10px rgba(22,35,59,0.05)",
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px]">Personality Questions</h3>
            <span className="font-mono-hr text-xs text-muted-foreground">
              {Object.keys(answers).length} / {DOPE_QUESTIONS.length} answered
            </span>
          </div>

          {DOPE_QUESTIONS.map((q, qi) => (
            <div
              key={q.id}
              className="py-3 border-b border-border last:border-b-0"
            >
              <div className="text-sm font-medium mb-2.5">
                <span className="font-mono-hr text-[hsl(var(--blue))] mr-1.5">
                  {qi + 1}.
                </span>
                {q.text}
              </div>
              <div className="space-y-1.5">
                {q.options.map((opt) => {
                  const selected = answers[q.id] === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() =>
                        setAnswers((p) => ({ ...p, [q.id]: opt.id }))
                      }
                      className={[
                        "w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors flex items-start gap-2.5",
                        selected
                          ? "border-[hsl(var(--blue))] bg-[hsl(var(--blue-pale))] text-foreground"
                          : "border-border bg-[hsl(var(--paper))] hover:border-[hsl(var(--blue-light))] text-foreground",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "w-4 h-4 rounded-full border flex-shrink-0 mt-0.5 flex items-center justify-center",
                          selected
                            ? "border-[hsl(var(--blue))] bg-[hsl(var(--blue))]"
                            : "border-border",
                        ].join(" ")}
                      >
                        {selected && (
                          <span className="w-1.5 h-1.5 rounded-full bg-white" />
                        )}
                      </span>
                      <span>{opt.text}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="flex gap-2 flex-wrap mt-4">
            <button
              onClick={() => setPhase("declaration")}
              disabled={!allAnswered}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-[hsl(var(--ink))] bg-[hsl(var(--ink))] text-white text-sm font-semibold hover:bg-[hsl(var(--blue-dark))] hover:border-[hsl(var(--blue-dark))] transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
            >
              Next: Declaration
            </button>
            <button
              onClick={() => setPhase("intro")}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-border bg-transparent text-foreground text-sm font-semibold hover:bg-[hsl(var(--paper-2))] transition-colors"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ---- DECLARATION ---- */
  if (phase === "declaration") {
    return (
      <div className="max-w-[640px]">
        <div className="flex items-start justify-between gap-5 mb-[22px]">
          <h1 className="text-2xl">Dope Personality Test</h1>
        </div>
        <div
          className="bg-card border border-border rounded-[10px] p-[18px]"
          style={{
            boxShadow:
              "0 1px 2px rgba(22,35,59,0.06), 0 2px 10px rgba(22,35,59,0.05)",
          }}
        >
          <h3 className="text-[15px] mb-2.5">Integrity Declaration</h3>
          <div className="flex gap-2.5 items-start py-3 bg-[hsl(var(--paper-2))] -mx-2 px-2 rounded-lg">
            <input
              type="checkbox"
              id="dc-select-all"
              checked={allChecked}
              onChange={(e) => {
                const val = e.target.checked;
                const next: Record<number, boolean> = {};
                DOPE_DECLARATIONS.forEach((_, i) => {
                  next[i] = val;
                });
                setChecks(next);
              }}
              className="mt-[3px] w-4 h-4 flex-shrink-0 accent-[hsl(var(--blue))]"
            />
            <label
              htmlFor="dc-select-all"
              className="text-sm font-semibold leading-relaxed"
            >
              I agree to all declarations
            </label>
          </div>
          <div className="my-3 border-t border-border" />
          {DOPE_DECLARATIONS.map((d, i) => (
            <div
              key={i}
              className="flex gap-2.5 items-start py-3 border-b border-border last:border-b-0"
            >
              <input
                type="checkbox"
                id={`dc-${i}`}
                checked={!!checks[i]}
                onChange={(e) =>
                  setChecks((p) => ({ ...p, [i]: e.target.checked }))
                }
                className="mt-[3px] w-4 h-4 flex-shrink-0 accent-[hsl(var(--blue))]"
              />
              <label htmlFor={`dc-${i}`} className="text-sm leading-relaxed">
                {d}
              </label>
            </div>
          ))}
          <div className="flex gap-2 flex-wrap mt-3.5">
            <button
              onClick={submitTest}
              disabled={!allChecked}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-[hsl(var(--ink))] bg-[hsl(var(--ink))] text-white text-sm font-semibold hover:bg-[hsl(var(--blue-dark))] hover:border-[hsl(var(--blue-dark))] transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
            >
              Submit & View Results
            </button>
            <button
              onClick={() => setPhase("questions")}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-border bg-transparent text-foreground text-sm font-semibold hover:bg-[hsl(var(--paper-2))] transition-colors"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ---- RESULT ---- */
  if (phase === "result" && latestResult) {
    const typeMeta = DOPE_PERSONALITY_TYPES[latestResult.personalityType];
    return (
      <div className="max-w-[640px]">
        <div className="flex items-start justify-between gap-5 mb-[22px]">
          <h1 className="text-2xl">Dope Personality Test — Results</h1>
        </div>

        <div
          className="bg-card border border-border rounded-[10px] p-[18px] mb-5"
          style={{
            boxShadow:
              "0 1px 2px rgba(22,35,59,0.06), 0 2px 10px rgba(22,35,59,0.05)",
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-block px-2.5 py-[3px] rounded-full text-[11px] font-semibold bg-[hsl(var(--green-pale))] text-[hsl(var(--green))]">
              Passed
            </span>
            <span className="font-mono-hr text-xs text-muted-foreground">
              {fmtDate(latestResult.date)} {fmtTime(latestResult.date)}
            </span>
          </div>
          <h2 className="text-[19px] mb-1.5">
            {typeMeta?.label || latestResult.personalityType}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            {latestResult.summary || typeMeta?.summary}
          </p>

          <div className="text-[13px] uppercase tracking-[0.06em] text-muted-foreground mb-2.5">
            Personality Trait Scores
          </div>
          {Object.entries(latestResult.scores).map(([trait, score]) => {
            const max = 15;
            const pct = Math.min(100, (score / max) * 100);
            return (
              <div key={trait} className="flex items-center gap-2.5 mb-2.5">
                <div className="text-[13px] w-[140px] flex-shrink-0">
                  {trait}
                </div>
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

          <div className="flex gap-2 flex-wrap mt-5">
            <button
              onClick={() => downloadDopeResult(session.profile, latestResult)}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-[hsl(var(--ink))] bg-[hsl(var(--ink))] text-white text-sm font-semibold hover:bg-[hsl(var(--blue-dark))] hover:border-[hsl(var(--blue-dark))] transition-colors"
            >
              Download Test Result
            </button>
            <button
              onClick={() => setPhase("intro")}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-border bg-transparent text-foreground text-sm font-semibold hover:bg-[hsl(var(--paper-2))] transition-colors"
            >
              Back to List
            </button>
          </div>
          <div className="text-xs text-muted-foreground mt-4 leading-relaxed">
            This test result has been saved in your private space. Only you and
            the system administrator can view it.
          </div>
        </div>
      </div>
    );
  }

  return null;
}
