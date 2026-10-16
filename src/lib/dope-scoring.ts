import type { DopeAnswer, DopeResult, DopeStatus } from "./hr-types";
import {
  DOPE_QUESTIONS,
  DOPE_TRAITS,
  DOPE_PERSONALITY_TYPES,
  DOPE_REMINDER_DAYS,
  DOPE_VALID_DAYS,
} from "./hr-constants";
import { daysBetween, todayISO, uid } from "./hr-store";

/* ---------- dope status ---------- */
export function getDopeStatus(history: DopeResult[]): DopeStatus {
  if (!history || history.length === 0) {
    return { state: "first_time" };
  }
  const sorted = [...history].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  const last = sorted[0];
  const daysSince = daysBetween(last.date, todayISO());
  const daysLeft = DOPE_VALID_DAYS - daysSince;
  if (daysLeft <= 0) return { state: "overdue", daysOverdue: -daysLeft, last };
  if (daysLeft <= DOPE_REMINDER_DAYS)
    return { state: "reminder", daysLeft, last };
  return { state: "valid", daysLeft, last };
}

/* ---------- dope test scoring ---------- */
export function scoreDopeTest(answers: DopeAnswer[]): {
  scores: Record<string, number>;
  personalityType: string;
  summary: string;
} {
  const scores: Record<string, number> = {};
  DOPE_TRAITS.forEach((t) => (scores[t] = 0));
  answers.forEach((ans) => {
    const q = DOPE_QUESTIONS.find((qq) => qq.id === ans.questionId);
    if (!q) return;
    const opt = q.options.find((o) => o.id === ans.optionId);
    if (!opt) return;
    Object.entries(opt.traits).forEach(([trait, val]) => {
      scores[trait] = (scores[trait] || 0) + val;
    });
  });
  const personalityType = Object.entries(scores).sort(
    (a, b) => b[1] - a[1],
  )[0][0];
  const meta = DOPE_PERSONALITY_TYPES[personalityType];
  const summary = meta ? meta.summary : "";
  return { scores, personalityType, summary };
}

export function buildDopeResult(answers: DopeAnswer[]): DopeResult {
  const { scores, personalityType, summary } = scoreDopeTest(answers);
  return {
    id: uid(),
    date: todayISO(),
    status: "Pass",
    answers,
    scores,
    personalityType,
    summary,
  };
}
