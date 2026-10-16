import { DOPE_PERSONALITY_TYPES, DOPE_QUESTIONS, DOPE_TRAITS } from "./dope-constants";
import { config } from "../config";
import { daysBetween, todayISO } from "./time";
import { badRequest } from "./errors";

export interface DopeAnswer {
  questionId: string;
  optionId: string;
}

export interface DopeResultDto {
  id: string;
  date: string;
  status: "Pass";
  answers: DopeAnswer[];
  scores: Record<string, number>;
  personalityType: string;
  summary: string;
}

export type DopeStatus =
  | { state: "first_time" }
  | { state: "valid" | "reminder"; daysLeft: number; last: DopeResultDto }
  | { state: "overdue"; daysOverdue: number; last: DopeResultDto };

/** Same scoring as the frontend, but run on the server so it can't be faked. */
export function scoreDope(answers: DopeAnswer[]) {
  // Every question must be answered exactly once with a real option.
  if (answers.length !== DOPE_QUESTIONS.length) {
    throw badRequest(`Please answer all ${DOPE_QUESTIONS.length} questions.`);
  }
  const seen = new Set<string>();
  const scores: Record<string, number> = {};
  DOPE_TRAITS.forEach((t) => (scores[t] = 0));
  for (const ans of answers) {
    const q = DOPE_QUESTIONS.find((qq) => qq.id === ans.questionId);
    const opt = q?.options.find((o) => o.id === ans.optionId);
    if (!q || !opt || seen.has(q.id)) throw badRequest("Invalid answer submitted.");
    seen.add(q.id);
    Object.entries(opt.traits).forEach(([trait, val]) => {
      scores[trait] = (scores[trait] || 0) + val;
    });
  }
  const personalityType = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
  const summary = DOPE_PERSONALITY_TYPES[personalityType]?.summary ?? "";
  return { scores, personalityType, summary };
}

export function dopeStatus(history: DopeResultDto[]): DopeStatus {
  if (!history.length) return { state: "first_time" };
  const last = [...history].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const daysLeft = config.rules.dopeValidDays - daysBetween(last.date, todayISO());
  if (daysLeft <= 0) return { state: "overdue", daysOverdue: -daysLeft, last };
  if (daysLeft <= config.rules.dopeReminderDays) return { state: "reminder", daysLeft, last };
  return { state: "valid", daysLeft, last };
}
