/* Copied verbatim from the frontend (src/lib/hr-constants.ts) so the server
   scores the personality test itself instead of trusting the client. Keep the
   two files in sync if the questions change. */
type ModuleId = string;

export const DOPE_VALID_DAYS = 182; // ~6 months
export const DOPE_REMINDER_DAYS = 14; // start reminding 14 days before due

export const HOLIDAYS_2026: Record<string, string> = {
  "2026-01-01": "New Year's Day",
  "2026-02-17": "Chinese New Year",
  "2026-08-31": "National Day",
  "2026-09-16": "Malaysia Day",
  "2026-12-25": "Christmas Day",
};

export interface ModuleDef {
  id: ModuleId;
  label: string;
  num: string;
  blurb: string;
}

export const MODULES: ModuleDef[] = [
  { id: "dashboard", label: "Dashboard", num: "0", blurb: "" },
  {
    id: "attendance",
    label: "Attendance",
    num: "1",
    blurb: "Clock in / clock out, track work hours.",
  },
  {
    id: "leave",
    label: "Leave",
    num: "2",
    blurb: "Apply for leave and check balance.",
  },
  {
    id: "payslip",
    label: "Payslip",
    num: "3",
    blurb: "Generate and view monthly payslips.",
  },
  {
    id: "claim",
    label: "Claim",
    num: "4",
    blurb: "Submit and track expense claims.",
  },
  {
    id: "evaluation",
    label: "Evaluation",
    num: "5",
    blurb: "View evaluations and performance.",
  },
  {
    id: "calendar",
    label: "Calendar",
    num: "6",
    blurb: "Company calendar and public holidays.",
  },
  {
    id: "dopetest",
    label: "Dope Personality Test",
    num: "7",
    blurb: "Staff personality & integrity test.",
  },
  {
    id: "notifications",
    label: "Notifications",
    num: "8",
    blurb: "Your HR notifications & updates.",
  },
  {
    id: "admin",
    label: "Admin Panel",
    num: "9",
    blurb: "Admin: view all test results.",
  },
];

export const DOPE_DECLARATIONS = [
  "I confirm that I am not under the influence of any prohibited substances while on duty.",
  "I agree to undergo random drug testing throughout my period of service.",
  "I understand that a positive result will be subject to the company's disciplinary procedures.",
  "The information I provide in this declaration is true and accurate.",
];

/* ---- Personality Test questions ---- */
export interface DopeQuestion {
  id: string;
  text: string;
  options: { id: string; text: string; traits: Record<string, number> }[];
}

export const DOPE_QUESTIONS: DopeQuestion[] = [
  {
    id: "q1",
    text: "What is your approach when facing a new challenging task?",
    options: [
      {
        id: "a",
        text: "Plan carefully and thoroughly before starting",
        traits: { Conscientiousness: 3, Steadiness: 1 },
      },
      {
        id: "b",
        text: "Start right away and adapt along the way",
        traits: { Dominance: 2, Influence: 2 },
      },
      {
        id: "c",
        text: "Collaborate with colleagues to find a solution",
        traits: { Influence: 3, Compliance: 1 },
      },
      {
        id: "d",
        text: "Analyze risks and data before making a decision",
        traits: { Compliance: 3, Conscientiousness: 2 },
      },
    ],
  },
  {
    id: "q2",
    text: "How do you handle conflict within a team?",
    options: [
      {
        id: "a",
        text: "Take control and resolve it directly",
        traits: { Dominance: 3 },
      },
      {
        id: "b",
        text: "Discuss openly and seek mutual understanding",
        traits: { Influence: 2, Steadiness: 2 },
      },
      {
        id: "c",
        text: "Listen to all parties and find a fair solution",
        traits: { Steadiness: 3, Compliance: 1 },
      },
      {
        id: "d",
        text: "Refer to company policies and procedures as a guide",
        traits: { Compliance: 3 },
      },
    ],
  },
  {
    id: "q3",
    text: "What is your communication style at work?",
    options: [
      {
        id: "a",
        text: "Direct, concise, and results-focused",
        traits: { Dominance: 3 },
      },
      {
        id: "b",
        text: "Friendly, expressive, and sociable",
        traits: { Influence: 3 },
      },
      {
        id: "c",
        text: "Calm, patient, and a team supporter",
        traits: { Steadiness: 3 },
      },
      {
        id: "d",
        text: "Detailed, precise, and factual",
        traits: { Compliance: 3 },
      },
    ],
  },
  {
    id: "q4",
    text: "How do you act under tight time pressure?",
    options: [
      {
        id: "a",
        text: "Stay focused and push to finish on time",
        traits: { Dominance: 2, Conscientiousness: 2 },
      },
      {
        id: "b",
        text: "Seek team support to share the workload",
        traits: { Influence: 1, Steadiness: 2 },
      },
      {
        id: "c",
        text: "Stay calm, prioritize, and work consistently",
        traits: { Steadiness: 3, Conscientiousness: 1 },
      },
      {
        id: "d",
        text: "Double-check requirements and ensure no errors",
        traits: { Compliance: 3 },
      },
    ],
  },
  {
    id: "q5",
    text: "What motivates you most at work?",
    options: [
      {
        id: "a",
        text: "Achieving targets and leading projects to success",
        traits: { Dominance: 3 },
      },
      {
        id: "b",
        text: "Recognition, social connections, and a positive atmosphere",
        traits: { Influence: 3 },
      },
      {
        id: "c",
        text: "Stability, teamwork, and a harmonious environment",
        traits: { Steadiness: 3 },
      },
      {
        id: "d",
        text: "Quality, accuracy, and adherence to standards",
        traits: { Compliance: 3 },
      },
    ],
  },
  {
    id: "q6",
    text: "How do you make important decisions?",
    options: [
      {
        id: "a",
        text: "Based on instinct and self-confidence",
        traits: { Dominance: 3 },
      },
      {
        id: "b",
        text: "Based on input and opinions from others",
        traits: { Influence: 2, Steadiness: 1 },
      },
      {
        id: "c",
        text: "Based on experience and careful consideration",
        traits: { Steadiness: 2, Conscientiousness: 2 },
      },
      {
        id: "d",
        text: "Based on data, facts, and thorough analysis",
        traits: { Compliance: 3, Conscientiousness: 1 },
      },
    ],
  },
];

export const DOPE_TRAITS = [
  "Dominance",
  "Influence",
  "Steadiness",
  "Compliance",
  "Conscientiousness",
] as const;

export const DOPE_PERSONALITY_TYPES: Record<
  string,
  { label: string; summary: string }
> = {
  Dominance: {
    label: "Type D — The Driver",
    summary:
      "You are results-oriented, assertive, and enjoy leading. You are comfortable taking risks and making quick decisions. Suited for leadership roles and high-risk projects.",
  },
  Influence: {
    label: "Type I — The Influencer",
    summary:
      "You are friendly, expressive, and skilled at building relationships. You thrive in social settings and motivate teams. Suited for communication, sales, and customer relations roles.",
  },
  Steadiness: {
    label: "Type S — The Steady Supporter",
    summary:
      "You are calm, patient, and reliable. You support your team consistently and value a harmonious environment. Suited for support, administrative, and collaborative roles.",
  },
  Compliance: {
    label: "Type C — The Conscientious Analyst",
    summary:
      "You are meticulous, precise, and quality-oriented. You value standards, procedures, and accuracy. Suited for finance, audit, quality control, and data analysis roles.",
  },
  Conscientiousness: {
    label: "Type T — The Trustworthy Professional",
    summary:
      "You are responsible, efficient, and highly principled. You can be trusted to be punctual and complete tasks to a high standard. Suited for roles requiring reliability and discipline.",
  },
};
