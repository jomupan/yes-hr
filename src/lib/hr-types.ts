export type UserRole = "staff" | "admin";

export type AccountStatus = "active" | "inactive";

export interface UserProfile {
  username: string;
  fullName: string;
  role: string;
  joinedAt: string;
  isAdmin?: boolean;
  /** Department database id — the canonical link to the departments store.
   *  `departmentOf()` resolves this to its display name. */
  departmentId?: string;
  /** Legacy/derived department text label (kept for backward compatibility). */
  department?: string;
  email?: string;
  employeeId?: string;
  /** Company / subsidiary database id — the canonical link to the companies
   *  store. `companyOf()` resolves this to its display name. */
  companyId?: string;
  /** Legacy company / subsidiary label (defaults to "YES EMPIRE Group"). */
  company?: string;
  /** Authorization role used for route protection. */
  authRole?: UserRole;
  /** Hashed password for login (simple obfuscation — demo only). */
  passwordHash?: string;
  /** Soft-delete flag. Inactive accounts cannot log in but keep their HR history. */
  accountStatus?: AccountStatus;
}

export interface DopeAnswer {
  questionId: string;
  optionId: string;
}

export interface DopeResult {
  id: string;
  date: string;
  status: "Pass";
  answers: DopeAnswer[];
  scores: Record<string, number>;
  personalityType: string;
  summary: string;
}

export interface DopeData {
  history: DopeResult[];
}

export interface AttendanceRecord {
  date: string;
  clockIn: string;
  clockOut: string | null;
  location: string;
  clockOutLocation: string;
  /** Legacy field kept for backward compatibility (older records only). */
  selfie: string;
  /** Base64 data URL of the clock-in selfie captured by the camera. */
  clockInSelfie?: string;
  /** Base64 data URL of the clock-out selfie captured by the camera. */
  clockOutSelfie?: string;
}

export interface AttendanceData {
  records: AttendanceRecord[];
}

export type LeaveType = "Annual" | "Medical" | "Emergency";
export type LeaveStatus = "Pending" | "Approved" | "Rejected";

export interface LeaveAttachment {
  /** Original file name (sanitised before storage). */
  name: string;
  /** MIME type, validated against an allow-list. */
  type: string;
  /** File size in bytes. */
  size: number;
  /** Base64 data URL used to persist & re-download the file (frontend store). */
  dataUrl: string;
}

export interface LeaveApplication {
  id: string;
  type: LeaveType;
  from: string;
  to: string;
  reason: string;
  status: LeaveStatus;
  appliedAt: string;
  /** Optional supporting document uploaded by the staff member. */
  attachment?: LeaveAttachment | null;
  /** Admin-provided reason shown to staff when a leave is rejected. */
  rejectionReason?: string;
}

export interface LeaveData {
  balance: Record<LeaveType, number>;
  applications: LeaveApplication[];
}

export type NotificationCategory =
  | "leave"
  | "claim"
  | "payslip"
  | "evaluation"
  | "system"
  | "dopetest"
  | "attendance"
  | "employee";

export type NotificationPriority = "high" | "normal";

export interface HrNotification {
  id: string;
  /** Owning username — a user can only ever see their own notifications. */
  username: string;
  category: NotificationCategory;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  /** Id of the related record (leave app, claim, etc.) if any. */
  relatedId?: string;
  /** Optional CTA. */
  actionLabel?: string;
  /** Module id to navigate to when the action is clicked. */
  actionModule?: ModuleId;
  /** Admin route to open when an admin notification is clicked. */
  adminPath?: string;
  /** Coarse priority for admin notifications. */
  priority?: NotificationPriority;
}

export type ClaimType = "Travel" | "Medical" | "Equipment" | "Others";
export type ClaimStatus = "Pending" | "Approved" | "Rejected";

export interface ClaimRecord {
  id: string;
  type: ClaimType;
  amount: number;
  date: string;
  desc: string;
  status: ClaimStatus;
}

export interface ClaimData {
  claims: ClaimRecord[];
}

export interface EvaluationRecord {
  period: string;
  overall: number;
  categories: Record<string, number>;
  comments: string;
}

export interface EvalData {
  evaluations: EvaluationRecord[];
}

export type ModuleId =
  | "dashboard"
  | "attendance"
  | "leave"
  | "payslip"
  | "claim"
  | "evaluation"
  | "calendar"
  | "dopetest"
  | "notifications"
  | "profile"
  | "admin";

export interface DopeStatus {
  state: "first_time" | "valid" | "reminder" | "overdue";
  daysLeft?: number;
  daysOverdue?: number;
  last?: DopeResult;
}
