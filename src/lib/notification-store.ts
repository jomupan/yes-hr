import type {
  HrNotification,
  NotificationCategory,
  NotificationPriority,
} from "./hr-types";
import {
  getJSON,
  getUser,
  getUserIndex,
  setJSON,
  uid,
  nowISO,
} from "./hr-store";

/* ---------- storage ----------
   Notifications are keyed per-user so a staff member can only ever read
   their own notifications. There is no shared/global notification store. */
const key = (username: string) => `hr:notifications:${username}`;

export function getNotifications(username: string): HrNotification[] {
  return getJSON<HrNotification[]>(key(username), []);
}

export function saveNotifications(
  username: string,
  list: HrNotification[],
): void {
  setJSON(key(username), list);
}

export function unreadCount(username: string): number {
  return getNotifications(username).filter((n) => !n.isRead).length;
}

interface CreateInput {
  username: string;
  category: NotificationCategory;
  title: string;
  message: string;
  relatedId?: string;
  actionLabel?: string;
  actionModule?: HrNotification["actionModule"];
  adminPath?: string;
  priority?: NotificationPriority;
}

/** Create + persist a single notification for a user. Newest first. */
export function createNotification(input: CreateInput): void {
  const list = getNotifications(input.username);
  list.unshift({
    id: uid(),
    username: input.username,
    category: input.category,
    title: input.title,
    message: input.message,
    isRead: false,
    createdAt: nowISO(),
    relatedId: input.relatedId,
    actionLabel: input.actionLabel,
    actionModule: input.actionModule,
    adminPath: input.adminPath,
    priority: input.priority,
  });
  // Keep the list bounded.
  saveNotifications(input.username, list.slice(0, 100));
}

/* ---------- admin notifications ----------
   Admin notifications are delivered to every user whose role is "admin",
   so each admin keeps an independent read/unread state. There is no
   separate admin notification store — the same per-user store is reused. */
export function getAdminUsernames(): string[] {
  return getUserIndex().filter((u) => {
    const p = getUser(u);
    return !!p && (p.authRole === "admin" || p.isAdmin);
  });
}

interface AdminNotifyInput {
  category: NotificationCategory;
  title: string;
  message: string;
  relatedId?: string;
  actionLabel?: string;
  adminPath?: string;
  priority?: NotificationPriority;
}

/** Fan a notification out to every admin account. */
export function notifyAdmins(input: AdminNotifyInput): void {
  getAdminUsernames().forEach((admin) =>
    createNotification({
      username: admin,
      category: input.category,
      title: input.title,
      message: input.message,
      relatedId: input.relatedId,
      actionLabel: input.actionLabel,
      adminPath: input.adminPath,
      priority: input.priority,
    }),
  );
}

export function markNotificationRead(username: string, id: string): void {
  const list = getNotifications(username);
  const n = list.find((x) => x.id === id);
  if (n && !n.isRead) {
    n.isRead = true;
    saveNotifications(username, list);
  }
}

export function markAllRead(username: string): void {
  const list = getNotifications(username);
  let changed = false;
  list.forEach((n) => {
    if (!n.isRead) {
      n.isRead = true;
      changed = true;
    }
  });
  if (changed) saveNotifications(username, list);
}

export function deleteNotification(username: string, id: string): void {
  const list = getNotifications(username).filter((n) => n.id !== id);
  saveNotifications(username, list);
}

/* ---------- domain trigger helpers ----------
   These keep the notification copy in one place so both the staff portal
   (submit) and the admin portal (approve/reject) stay in sync. */

export function notifyLeaveSubmitted(
  username: string,
  type: string,
  from: string,
  to: string,
  appId: string,
): void {
  createNotification({
    username,
    category: "leave",
    title: "Leave Application Submitted",
    message: `Your ${type} leave application for ${from}–${to} has been submitted and is currently pending approval.`,
    relatedId: appId,
    actionLabel: "View leave",
    actionModule: "leave",
  });
}

export function notifyLeaveApproved(
  username: string,
  type: string,
  from: string,
  to: string,
  appId: string,
): void {
  createNotification({
    username,
    category: "leave",
    title: "Leave Application Approved",
    message: `Your ${type} leave application for ${from}–${to} has been approved.`,
    relatedId: appId,
    actionLabel: "View leave",
    actionModule: "leave",
  });
}

export function notifyLeaveRejected(
  username: string,
  type: string,
  from: string,
  to: string,
  appId: string,
  reason?: string,
): void {
  const base = `Your ${type} leave application for ${from}–${to} was not approved.`;
  const message = reason?.trim() ? `${base}\nReason: ${reason.trim()}` : base;
  createNotification({
    username,
    category: "leave",
    title: "Leave Application Rejected",
    message,
    relatedId: appId,
    actionLabel: "View leave",
    actionModule: "leave",
  });
}

export function notifyClaimSubmitted(username: string, claimId: string): void {
  createNotification({
    username,
    category: "claim",
    title: "Claim Submitted",
    message: "Your claim has been submitted and is currently pending review.",
    relatedId: claimId,
    actionLabel: "View claims",
    actionModule: "claim",
  });
}

export function notifyClaimApproved(username: string, claimId: string): void {
  createNotification({
    username,
    category: "claim",
    title: "Claim Approved",
    message: "Your claim has been approved.",
    relatedId: claimId,
    actionLabel: "View claims",
    actionModule: "claim",
  });
}

export function notifyClaimRejected(username: string, claimId: string): void {
  createNotification({
    username,
    category: "claim",
    title: "Claim Rejected",
    message: "Your claim was not approved.",
    relatedId: claimId,
    actionLabel: "View claims",
    actionModule: "claim",
  });
}

export function notifyPayslipAvailable(
  username: string,
  period: string,
  payslipId: string,
): void {
  createNotification({
    username,
    category: "payslip",
    title: "New Payslip Available",
    message: `Your ${period} payslip is now available.`,
    relatedId: payslipId,
    actionLabel: "View payslip",
    actionModule: "payslip",
  });
}

export function notifyDopeExpiring(username: string, daysLeft: number): void {
  createNotification({
    username,
    category: "dopetest",
    title: "Personality Test Expiring Soon",
    message: `Your Dope Personality Test will expire in ${daysLeft} days. Please retake the test.`,
    actionLabel: "Take test",
    actionModule: "dopetest",
  });
}

export function notifyDopeRequired(username: string): void {
  createNotification({
    username,
    category: "dopetest",
    title: "Personality Test Required",
    message: "Please complete your Dope Personality Test.",
    actionLabel: "Take test",
    actionModule: "dopetest",
  });
}

/* ---------- admin-side triggers ----------
   These mirror the staff-side helpers but notify every admin account.
   They are called only after the underlying record has been persisted,
   so no admin notification is ever created for a failed save. */

export function notifyAdminLeaveSubmitted(
  staffName: string,
  type: string,
  from: string,
  to: string,
  appId: string,
): void {
  notifyAdmins({
    category: "leave",
    title: "New Leave Application",
    message: `${staffName} has submitted an ${type} leave application for ${from}–${to}.`,
    relatedId: appId,
    actionLabel: "View Request",
    adminPath: "/admin/leave-requests",
    priority: "high",
  });
}

export function notifyAdminClaimSubmitted(
  staffName: string,
  amount: number,
  claimId: string,
): void {
  notifyAdmins({
    category: "claim",
    title: "New Claim Submitted",
    message: `${staffName} submitted a new RM${amount.toFixed(2)} claim for review.`,
    relatedId: claimId,
    actionLabel: "View Claim",
    adminPath: "/admin/claims",
    priority: "high",
  });
}

export function notifyAdminStaffRegistered(
  staffName: string,
  username: string,
): void {
  notifyAdmins({
    category: "employee",
    title: "New Staff Registered",
    message: `${staffName} has registered as a new staff member.`,
    relatedId: username,
    actionLabel: "View Employee",
    adminPath: "/admin/employees",
    priority: "normal",
  });
}

export function notifyAdminDopeCompleted(
  staffName: string,
  personalityType: string,
): void {
  notifyAdmins({
    category: "dopetest",
    title: "Personality Test Completed",
    message: `${staffName} has completed the Dope Personality Test (${personalityType}).`,
    actionLabel: "View Employee",
    adminPath: "/admin/employees",
    priority: "normal",
  });
}
