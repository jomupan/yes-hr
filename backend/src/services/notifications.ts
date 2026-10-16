import type { Knex } from "knex";
import { db } from "../db/knex";
import { config } from "../config";
import { nowISO } from "../lib/time";
import { newId } from "./users";

/* Notification copy is kept identical to src/lib/notification-store.ts so
   the frontend renders the same messages once it switches to the API. */

export type NotificationCategory =
  | "leave"
  | "claim"
  | "payslip"
  | "evaluation"
  | "system"
  | "dopetest"
  | "attendance"
  | "employee";

interface CreateInput {
  userId: string;
  category: NotificationCategory;
  title: string;
  message: string;
  relatedId?: string;
  actionLabel?: string;
  actionModule?: string;
  adminPath?: string;
  priority?: "high" | "normal";
}

export interface NotificationRow {
  id: string;
  user_id: string;
  category: string;
  title: string;
  message: string;
  is_read: number | boolean;
  created_at: string;
  related_id: string | null;
  action_label: string | null;
  action_module: string | null;
  admin_path: string | null;
  priority: string | null;
}

export function toNotificationDto(n: NotificationRow, username: string) {
  return {
    id: n.id,
    username,
    category: n.category,
    title: n.title,
    message: n.message,
    isRead: !!n.is_read,
    createdAt: n.created_at,
    relatedId: n.related_id ?? undefined,
    actionLabel: n.action_label ?? undefined,
    actionModule: n.action_module ?? undefined,
    adminPath: n.admin_path ?? undefined,
    priority: n.priority ?? undefined,
  };
}

export async function createNotification(input: CreateInput, trx: Knex = db): Promise<void> {
  await trx("notifications").insert({
    id: newId(),
    user_id: input.userId,
    category: input.category,
    title: input.title,
    message: input.message,
    is_read: false,
    created_at: nowISO(),
    related_id: input.relatedId ?? null,
    action_label: input.actionLabel ?? null,
    action_module: input.actionModule ?? null,
    admin_path: input.adminPath ?? null,
    priority: input.priority ?? null,
  });
  // Keep each user's list bounded (newest N), like the frontend store.
  const keep = await trx("notifications")
    .where({ user_id: input.userId })
    .orderBy("created_at", "desc")
    .offset(config.rules.notificationsPerUser)
    .limit(1000)
    .pluck("id");
  if (keep.length) await trx("notifications").whereIn("id", keep).del();
}

/** Fan out to every active admin; each keeps independent read state. */
export async function notifyAdmins(input: Omit<CreateInput, "userId">, trx: Knex = db): Promise<void> {
  const admins: string[] = await trx("users").where({ auth_role: "admin", account_status: "active" }).pluck("id");
  for (const id of admins) await createNotification({ ...input, userId: id }, trx);
}

/** Send the same notification to every active user except `exceptUserId`,
 *  in a single insert (fast even for a large staff list). */
export async function notifyEveryone(
  input: Omit<CreateInput, "userId">,
  exceptUserId: string | null,
  trx: Knex = db,
): Promise<void> {
  const q = trx("users").where({ account_status: "active" });
  if (exceptUserId) q.whereNot({ id: exceptUserId });
  const ids: string[] = await q.pluck("id");
  if (!ids.length) return;
  const now = nowISO();
  await trx.batchInsert(
    "notifications",
    ids.map((userId) => ({
      id: newId(),
      user_id: userId,
      category: input.category,
      title: input.title,
      message: input.message,
      is_read: false,
      created_at: now,
      related_id: input.relatedId ?? null,
      action_label: input.actionLabel ?? null,
      action_module: input.actionModule ?? null,
      admin_path: input.adminPath ?? null,
      priority: input.priority ?? null,
    })),
    100,
  );
}

/* ---------- domain triggers (same wording as the frontend) ---------- */

export const notify = {
  leaveSubmitted: (userId: string, type: string, from: string, to: string, appId: string, trx?: Knex) =>
    createNotification(
      {
        userId,
        category: "leave",
        title: "Leave Application Submitted",
        message: `Your ${type} leave application for ${from}–${to} has been submitted and is currently pending approval.`,
        relatedId: appId,
        actionLabel: "View leave",
        actionModule: "leave",
      },
      trx,
    ),
  leaveApproved: (userId: string, type: string, from: string, to: string, appId: string, trx?: Knex) =>
    createNotification(
      {
        userId,
        category: "leave",
        title: "Leave Application Approved",
        message: `Your ${type} leave application for ${from}–${to} has been approved.`,
        relatedId: appId,
        actionLabel: "View leave",
        actionModule: "leave",
      },
      trx,
    ),
  leaveRejected: (userId: string, type: string, from: string, to: string, appId: string, reason?: string, trx?: Knex) => {
    const base = `Your ${type} leave application for ${from}–${to} was not approved.`;
    return createNotification(
      {
        userId,
        category: "leave",
        title: "Leave Application Rejected",
        message: reason?.trim() ? `${base}\nReason: ${reason.trim()}` : base,
        relatedId: appId,
        actionLabel: "View leave",
        actionModule: "leave",
      },
      trx,
    );
  },
  claimSubmitted: (userId: string, claimId: string, trx?: Knex) =>
    createNotification(
      {
        userId,
        category: "claim",
        title: "Claim Submitted",
        message: "Your claim has been submitted and is currently pending review.",
        relatedId: claimId,
        actionLabel: "View claims",
        actionModule: "claim",
      },
      trx,
    ),
  claimApproved: (userId: string, claimId: string, trx?: Knex) =>
    createNotification(
      {
        userId,
        category: "claim",
        title: "Claim Approved",
        message: "Your claim has been approved.",
        relatedId: claimId,
        actionLabel: "View claims",
        actionModule: "claim",
      },
      trx,
    ),
  claimRejected: (userId: string, claimId: string, reason?: string, trx?: Knex) =>
    createNotification(
      {
        userId,
        category: "claim",
        title: "Claim Rejected",
        message: reason?.trim() ? `Your claim was not approved.\nReason: ${reason.trim()}` : "Your claim was not approved.",
        relatedId: claimId,
        actionLabel: "View claims",
        actionModule: "claim",
      },
      trx,
    ),
  payslipAvailable: (userId: string, period: string, payslipId: string, trx?: Knex) =>
    createNotification(
      {
        userId,
        category: "payslip",
        title: "New Payslip Available",
        message: `Your ${period} payslip is now available.`,
        relatedId: payslipId,
        actionLabel: "View payslip",
        actionModule: "payslip",
      },
      trx,
    ),
  evaluationAdded: (userId: string, period: string, evalId: string, trx?: Knex) =>
    createNotification(
      {
        userId,
        category: "evaluation",
        title: "New Performance Evaluation",
        message: `Your ${period} performance evaluation is now available.`,
        relatedId: evalId,
        actionLabel: "View evaluation",
        actionModule: "evaluation",
      },
      trx,
    ),

  dopeRequired: (userId: string, trx?: Knex) =>
    createNotification(
      {
        userId,
        category: "dopetest",
        title: "Personality Test Required",
        message: "Please complete your Dope Personality Test.",
        actionLabel: "Take test",
        actionModule: "dopetest",
      },
      trx,
    ),
  dopeExpiring: (userId: string, daysLeft: number, trx?: Knex) =>
    createNotification(
      {
        userId,
        category: "dopetest",
        title: "Personality Test Expiring Soon",
        message: `Your Dope Personality Test will expire in ${daysLeft} days. Please retake the test.`,
        actionLabel: "Take test",
        actionModule: "dopetest",
      },
      trx,
    ),

  adminLeaveSubmitted: (staffName: string, type: string, from: string, to: string, appId: string, trx?: Knex) =>
    notifyAdmins(
      {
        category: "leave",
        title: "New Leave Application",
        message: `${staffName} has submitted an ${type} leave application for ${from}–${to}.`,
        relatedId: appId,
        actionLabel: "View Request",
        adminPath: "/admin/leave-requests",
        priority: "high",
      },
      trx,
    ),
  adminClaimSubmitted: (staffName: string, amount: number, claimId: string, trx?: Knex) =>
    notifyAdmins(
      {
        category: "claim",
        title: "New Claim Submitted",
        message: `${staffName} submitted a new RM${amount.toFixed(2)} claim for review.`,
        relatedId: claimId,
        actionLabel: "View Claim",
        adminPath: "/admin/claims",
        priority: "high",
      },
      trx,
    ),
  adminStaffRegistered: (staffName: string, username: string, trx?: Knex) =>
    notifyAdmins(
      {
        category: "employee",
        title: "New Staff Registered",
        message: `${staffName} has registered as a new staff member.`,
        relatedId: username,
        actionLabel: "View Employee",
        adminPath: "/admin/employees",
        priority: "normal",
      },
      trx,
    ),
  adminDopeCompleted: (staffName: string, personalityType: string, trx?: Knex) =>
    notifyAdmins(
      {
        category: "dopetest",
        title: "Personality Test Completed",
        message: `${staffName} has completed the Dope Personality Test (${personalityType}).`,
        actionLabel: "View Employee",
        adminPath: "/admin/employees",
        priority: "normal",
      },
      trx,
    ),
};
