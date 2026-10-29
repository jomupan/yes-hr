import fs from "fs";
import path from "path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { config } from "../src/config";
import { db, migrateLatest } from "../src/db/knex";
import { seed } from "../src/db/seed";
import { createApp } from "../src/app";
import { DOPE_QUESTIONS } from "../src/lib/dope-constants";

const app = createApp();

// Smallest valid PNG (1x1) and a tiny PDF, so magic-byte checks pass.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const SELFIE = `data:image/png;base64,${PNG.toString("base64")}`;

let adminToken = "";
let staffToken = "";
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

beforeAll(async () => {
  fs.rmSync(path.dirname(config.sqliteFile), { recursive: true, force: true });
  fs.mkdirSync(config.uploadDir, { recursive: true });
  // Start from an empty database every run (Postgres keeps data between runs).
  if (config.dbClient !== "sqlite") await db.migrate.rollback(undefined, true);
  await migrateLatest();
  await seed();
});

afterAll(async () => {
  await db.destroy();
});

describe("health + public", () => {
  it("answers /api/ping without needing the database", async () => {
    const r = await request(app).get("/api/ping");
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
  });

  it("reports healthy", async () => {
    const r = await request(app).get("/api/health");
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
  });

  it("lists active companies and departments for registration", async () => {
    const c = await request(app).get("/api/public/companies");
    expect(c.body.companies.map((x: any) => x.id)).toContain("yes-empire-group");
    const d = await request(app).get("/api/public/departments?companyId=yes-empire-group");
    expect(d.body.departments.length).toBe(8);
  });
});

describe("auth", () => {
  it("logs in the seeded admin by username, email or employee ID", async () => {
    for (const identifier of ["admin", "ADMIN@yesempire.com", "emp001"]) {
      const r = await request(app).post("/api/auth/login").send({ identifier, password: "admin123" });
      expect(r.status).toBe(200);
      expect(r.body.session.authRole).toBe("admin");
      adminToken = r.body.token;
    }
  });

  it("gives a long login only when Remember me is ticked", async () => {
    const life = async (remember?: boolean) => {
      const r = await request(app).post("/api/auth/login").send({ identifier: "admin", password: "admin123", remember });
      expect(r.status).toBe(200);
      const p = JSON.parse(Buffer.from(r.body.token.split(".")[1], "base64url").toString());
      return p.exp - p.iat;
    };
    expect(await life()).toBeLessThan(24 * 3600 + 1);
    expect(await life(true)).toBe(30 * 24 * 3600);
  });

  it("refuses a request when the screen belongs to a different account", async () => {
    const t = (await request(app).post("/api/auth/login").send({ identifier: "admin", password: "admin123" })).body.token;
    const ok = await request(app).get("/api/me/attendance").set(auth(t)).set("X-HR-User", "admin");
    expect(ok.status).toBe(200);
    const bad = await request(app).get("/api/me/attendance").set(auth(t)).set("X-HR-User", "someone.else");
    expect(bad.status).toBe(401);
    expect(bad.body.code).toBe("ACCOUNT_SWITCHED");
  });

  it("rejects bad credentials with one generic message", async () => {
    const a = await request(app).post("/api/auth/login").send({ identifier: "admin", password: "nope" });
    const b = await request(app).post("/api/auth/login").send({ identifier: "ghost", password: "nope" });
    expect(a.status).toBe(401);
    expect(a.body.error).toBe(b.body.error);
  });

  it("registers staff (never admin) and enforces password + department rules", async () => {
    const base = { name: "Nurin", username: "nurin", role: "IT Executive", companyId: "yes-empire-group" };
    const weak = await request(app).post("/api/auth/register").send({ ...base, password: "short", departmentId: "it" });
    expect(weak.status).toBe(400);
    const badDept = await request(app).post("/api/auth/register").send({ ...base, password: "Passw0rd!", departmentId: "nope" });
    expect(badDept.status).toBe(400);
    const ok = await request(app).post("/api/auth/register").send({ ...base, password: "Passw0rd!", departmentId: "it" });
    expect(ok.status).toBe(201);
    expect(ok.body.session.authRole).toBe("staff");
    expect(ok.body.session.profile.department).toBe("IT");
    expect(ok.body.session.profile.employeeId).toMatch(/^EMP\d{3}$/);
    staffToken = ok.body.token;
    const dup = await request(app).post("/api/auth/register").send({ ...base, password: "Passw0rd!", departmentId: "it" });
    expect(dup.status).toBe(409);
  });

  it("blocks staff from admin routes and anonymous users from everything", async () => {
    expect((await request(app).get("/api/admin/employees").set(auth(staffToken))).status).toBe(403);
    expect((await request(app).get("/api/me")).status).toBe(401);
  });

  it("runs the forgot / reset password flow with a single-use token", async () => {
    const f = await request(app).post("/api/auth/forgot-password").send({ identifier: "nurin" });
    const token = f.body.devToken;
    expect(token).toBeTruthy();
    expect((await request(app).get(`/api/auth/reset-password/${token}`)).body.valid).toBe(true);
    const r = await request(app).post("/api/auth/reset-password").send({ token, newPassword: "NewPassw0rd" });
    expect(r.status).toBe(200);
    expect((await request(app).post("/api/auth/reset-password").send({ token, newPassword: "NewPassw0rd" })).status).toBe(400);
    const login = await request(app).post("/api/auth/login").send({ identifier: "nurin", password: "NewPassw0rd" });
    expect(login.status).toBe(200);
    staffToken = login.body.token;
  });
});

describe("staff self-service", () => {
  it("creates the 'test required' notification once", async () => {
    await request(app).get("/api/me").set(auth(staffToken));
    await request(app).get("/api/me").set(auth(staffToken));
    const n = await request(app).get("/api/notifications?category=dopetest").set(auth(staffToken));
    expect(n.body.notifications.filter((x: any) => x.title === "Personality Test Required")).toHaveLength(1);
  });

  it("scores the DOPE test on the server", async () => {
    const answers = DOPE_QUESTIONS.map((q) => ({ questionId: q.id, optionId: q.options[0].id }));
    const partial = await request(app).post("/api/me/dope").set(auth(staffToken)).send({ answers: answers.slice(1), declarationsAccepted: true });
    expect(partial.status).toBe(400);
    const r = await request(app).post("/api/me/dope").set(auth(staffToken)).send({ answers, declarationsAccepted: true });
    expect(r.status).toBe(201);
    expect(r.body.result.personalityType).toBeTruthy();
    expect(r.body.status.state).toBe("valid");
  });

  it("clocks in and out once per day with selfies", async () => {
    const i = await request(app).post("/api/me/attendance/clock-in").set(auth(staffToken)).send({ location: "HQ", selfie: SELFIE });
    expect(i.status).toBe(201);
    expect((await request(app).post("/api/me/attendance/clock-in").set(auth(staffToken)).send({ location: "HQ", selfie: SELFIE })).status).toBe(409);
    const o = await request(app).post("/api/me/attendance/clock-out").set(auth(staffToken)).send({ location: "HQ", selfie: SELFIE });
    expect(o.status).toBe(200);
    expect(o.body.record.clockOut).toBeTruthy();
    // Selfie loads via ?token= for <img src>.
    const img = await request(app).get(`${o.body.record.clockInSelfie}?token=${staffToken}`);
    expect(img.status).toBe(200);
    expect(img.headers["content-type"]).toBe("image/png");
  });

  it("rejects selfies that aren't images", async () => {
    const r = await request(app)
      .post("/api/me/attendance/clock-in")
      .set(auth(adminToken))
      .send({ location: "HQ", selfie: "data:image/png;base64,aGVsbG8=" });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe("SELFIE_INVALID");
  });

  let leaveId = "";
  it("applies for leave with rules matching the UI", async () => {
    const noDoc = await request(app).post("/api/me/leave").set(auth(staffToken))
      .field({ type: "Medical", from: "2026-11-02", to: "2026-11-03", reason: "Flu" });
    expect(noDoc.status).toBe(400);
    const fake = await request(app).post("/api/me/leave").set(auth(staffToken))
      .field({ type: "Medical", from: "2026-11-02", to: "2026-11-03", reason: "Flu" })
      .attach("attachment", Buffer.from("MZ not a pdf"), { filename: "mc.pdf", contentType: "application/pdf" });
    expect(fake.status).toBe(400);
    const ok = await request(app).post("/api/me/leave").set(auth(staffToken))
      .field({ type: "Medical", from: "2026-11-02", to: "2026-11-03", reason: "Flu" })
      .attach("attachment", PDF, { filename: "mc.pdf", contentType: "application/pdf" });
    expect(ok.status).toBe(201);
    expect(ok.body.application.days).toBe(2);
    leaveId = ok.body.application.id;
    const overlap = await request(app).post("/api/me/leave").set(auth(staffToken))
      .field({ type: "Annual", from: "2026-11-03", to: "2026-11-04", reason: "Trip" });
    expect(overlap.status).toBe(409);
    const tooLong = await request(app).post("/api/me/leave").set(auth(staffToken))
      .field({ type: "Emergency", from: "2026-12-01", to: "2026-12-10", reason: "x" });
    expect(tooLong.status).toBe(400);
  });

  it("submits a claim and blocks future dates", async () => {
    const fut = await request(app).post("/api/me/claims").set(auth(staffToken)).send({ type: "Travel", amount: 10, date: "2099-01-01", desc: "x" });
    expect(fut.status).toBe(400);
    const ok = await request(app).post("/api/me/claims").set(auth(staffToken)).send({ type: "Travel", amount: "45.50", date: "2026-10-01", desc: "Grab to client" });
    expect(ok.status).toBe(201);
    expect(ok.body.claim.amount).toBe(45.5);
  });

  it("admin approves leave, balance drops, staff is notified", async () => {
    const list = await request(app).get("/api/admin/leave?status=Pending").set(auth(adminToken));
    expect(list.body.applications.some((a: any) => a.id === leaveId)).toBe(true);
    const ap = await request(app).patch(`/api/admin/leave/${leaveId}/status`).set(auth(adminToken)).send({ status: "Approved" });
    expect(ap.status).toBe(200);
    const me = await request(app).get("/api/me/leave").set(auth(staffToken));
    expect(me.body.balance.Medical).toBe(12);
    // Moving it back restores the balance.
    await request(app).patch(`/api/admin/leave/${leaveId}/status`).set(auth(adminToken)).send({ status: "Rejected", rejectionReason: "No MC stamp" });
    const me2 = await request(app).get("/api/me/leave").set(auth(staffToken));
    expect(me2.body.balance.Medical).toBe(14);
    expect(me2.body.applications[0].rejectionReason).toBe("No MC stamp");
    const n = await request(app).get("/api/notifications?category=leave").set(auth(staffToken));
    expect(n.body.notifications.map((x: any) => x.title)).toEqual(
      expect.arrayContaining(["Leave Application Approved", "Leave Application Rejected"]),
    );
  });

  it("admins get fan-out notifications and can mark them read", async () => {
    const n = await request(app).get("/api/notifications").set(auth(adminToken));
    expect(n.body.unread).toBeGreaterThan(0);
    await request(app).post("/api/notifications/read-all").set(auth(adminToken));
    expect((await request(app).get("/api/notifications/unread-count").set(auth(adminToken))).body.unread).toBe(0);
  });
});

describe("admin", () => {
  it("uploads a payslip that only the owner can see", async () => {
    const up = await request(app).post("/api/admin/payslips").set(auth(adminToken))
      .field({ username: "nurin", month: "9", year: "2026" })
      .attach("file", PDF, { filename: "sept.pdf", contentType: "application/pdf" });
    expect(up.status).toBe(201);
    const dup = await request(app).post("/api/admin/payslips").set(auth(adminToken))
      .field({ username: "nurin", month: "9", year: "2026" })
      .attach("file", PDF, { filename: "sept.pdf", contentType: "application/pdf" });
    expect(dup.status).toBe(409);
    const mine = await request(app).get("/api/me/payslips").set(auth(staffToken));
    expect(mine.body.payslips).toHaveLength(1);
    const file = await request(app).get(mine.body.payslips[0].file.url).set(auth(staffToken));
    expect(file.status).toBe(200);
    // Another staff member can't fetch it.
    const aina = (await request(app).post("/api/auth/login").send({ identifier: "aina", password: "staff123" })).body.token;
    expect((await request(app).get(mine.body.payslips[0].file.url).set(auth(aina))).status).toBe(404);
    // Soft-remove hides it from staff.
    await request(app).delete(`/api/admin/payslips/${up.body.payslip.id}`).set(auth(adminToken));
    expect((await request(app).get("/api/me/payslips").set(auth(staffToken))).body.payslips).toHaveLength(0);
  });

  it("shows today's attendance with a summary", async () => {
    const r = await request(app).get("/api/admin/attendance").set(auth(adminToken));
    expect(r.status).toBe(200);
    const nurin = r.body.rows.find((x: any) => x.username === "nurin");
    expect(["Present", "Late"]).toContain(nurin.status);
    expect(r.body.summary.totalActive).toBe(2);
    expect(r.body.rows.some((x: any) => x.username === "admin")).toBe(false);
  });

  it("adds an evaluation the staff member can read", async () => {
    const r = await request(app).post("/api/admin/employees/nurin/evaluations").set(auth(adminToken))
      .send({ period: "2026 H1", overall: 85, categories: { Teamwork: 90 }, comments: "Great start." });
    expect(r.status).toBe(201);
    const mine = await request(app).get("/api/me/evaluations").set(auth(staffToken));
    expect(mine.body.evaluations.at(-1).overall).toBe(85);
  });

  it("manages companies and departments with safe deletes", async () => {
    const c = await request(app).post("/api/admin/companies").set(auth(adminToken))
      .send({ name: "YES Digital", type: "subsidiary", parentCompanyId: "yes-empire-group" });
    expect(c.status).toBe(201);
    const d = await request(app).post("/api/admin/departments").set(auth(adminToken)).send({ name: "Design", companyId: c.body.company.id });
    expect(d.status).toBe(201);
    expect((await request(app).delete(`/api/admin/companies/${c.body.company.id}`).set(auth(adminToken))).status).toBe(400);
    expect((await request(app).delete("/api/admin/departments/it").set(auth(adminToken))).status).toBe(400);
  });

  it("deactivating staff blocks login and existing tokens immediately", async () => {
    const r = await request(app).post("/api/admin/employees/nurin/deactivate").set(auth(adminToken));
    expect(r.status).toBe(200);
    expect((await request(app).get("/api/me").set(auth(staffToken))).status).toBe(403);
    const login = await request(app).post("/api/auth/login").send({ identifier: "nurin", password: "NewPassw0rd" });
    expect(login.body.code).toBe("ACCOUNT_INACTIVE");
    await request(app).post("/api/admin/employees/nurin/reactivate").set(auth(adminToken));
  });

  it("protects the last admin and writes an audit log", async () => {
    const self = await request(app).post("/api/admin/admins/admin/deactivate").set(auth(adminToken));
    expect(self.status).toBe(400);
    const created = await request(app).post("/api/admin/admins").set(auth(adminToken))
      .send({ fullName: "Second Admin", username: "admin2", email: "admin2@yesempire.com", password: "Adm1nPass" });
    expect(created.status).toBe(201);
    expect(created.body.admin.employeeId).toMatch(/^ADM\d{3}$/);
    const log = await request(app).get("/api/admin/audit-log").set(auth(adminToken));
    expect(log.body.entries.some((e: any) => e.action === "admin_created")).toBe(true);
  });

  it("returns dashboard and report numbers", async () => {
    const d = await request(app).get("/api/admin/dashboard").set(auth(adminToken));
    expect(d.body.employees.active).toBe(4);
    expect(d.body.pendingClaims).toBe(1);
    const r = await request(app).get("/api/admin/reports?from=2026-10-01&to=2026-12-31").set(auth(adminToken));
    expect(r.status).toBe(200);
    expect(r.body.personality.completed).toBe(1);
  });
});

describe("calendar notes", () => {
  let id = "";
  it("admin adds a note that every staff member can read and is notified about", async () => {
    const bad = await request(app).post("/api/admin/calendar").set(auth(adminToken)).send({ title: "", from: "2026-11-03" });
    expect(bad.status).toBe(400);
    const backwards = await request(app).post("/api/admin/calendar").set(auth(adminToken)).send({ title: "Trip", from: "2026-11-05", to: "2026-11-03" });
    expect(backwards.status).toBe(400);
    const r = await request(app).post("/api/admin/calendar").set(auth(adminToken))
      .send({ title: "Town hall", note: "Main hall, 3pm", from: "2026-11-03" });
    expect(r.status).toBe(201);
    expect(r.body.event.to).toBe("2026-11-03");
    id = r.body.event.id;
    const list = await request(app).get("/api/calendar?from=2026-11-01&to=2026-11-30").set(auth(staffToken));
    expect(list.body.events.map((e: any) => e.title)).toContain("Town hall");
    const n = await request(app).get("/api/notifications").set(auth(staffToken));
    expect(n.body.notifications.some((x: any) => x.title === "New Calendar Note" && x.actionModule === "calendar")).toBe(true);
  });

  it("staff can't add, edit or delete notes", async () => {
    expect((await request(app).post("/api/admin/calendar").set(auth(staffToken)).send({ title: "x", from: "2026-11-03" })).status).toBe(403);
    expect((await request(app).delete(`/api/admin/calendar/${id}`).set(auth(staffToken))).status).toBe(403);
  });

  it("admin edits and deletes a note", async () => {
    const e = await request(app).put(`/api/admin/calendar/${id}`).set(auth(adminToken))
      .send({ title: "Town hall (moved)", from: "2026-11-04", to: "2026-11-05", category: "reminder" });
    expect(e.status).toBe(200);
    expect(e.body.event.to).toBe("2026-11-05");
    expect((await request(app).delete(`/api/admin/calendar/${id}`).set(auth(adminToken))).status).toBe(200);
    const list = await request(app).get("/api/calendar?from=2026-11-01&to=2026-11-30").set(auth(staffToken));
    expect(list.body.events).toHaveLength(0);
  });
});

describe("replacement leave", () => {
  let sukma = "";
  it("only admins can manage replacement leave", async () => {
    expect((await request(app).get("/api/admin/replacement-leaves").set(auth(staffToken))).status).toBe(403);
  });

  it("admin adds one for all staff; staff see the balance and get notified", async () => {
    const bad = await request(app).post("/api/admin/replacement-leaves").set(auth(adminToken)).send({ name: "", days: 0 });
    expect(bad.status).toBe(400);
    const r = await request(app).post("/api/admin/replacement-leaves").set(auth(adminToken))
      .send({ name: "Replacement Leave SUKMA", days: 2, expiresOn: "2027-06-30" });
    expect(r.status).toBe(201);
    const entry = r.body.replacementLeaves.find((x: any) => x.name === "Replacement Leave SUKMA");
    expect(entry.staff.some((s: any) => s.username === "nurin")).toBe(true);
    expect(entry.staff.some((s: any) => s.username === "admin")).toBe(false);
    sukma = entry.id;
    const mine = await request(app).get("/api/me/leave").set(auth(staffToken));
    expect(mine.body.replacement).toEqual([
      expect.objectContaining({ id: sukma, name: "Replacement Leave SUKMA", balance: 2, expiresOn: "2027-06-30", expired: false }),
    ]);
    const n = await request(app).get("/api/notifications").set(auth(staffToken));
    expect(n.body.notifications.some((x: any) => x.title === "Replacement Leave Added")).toBe(true);
  });

  it("staff apply for it; approval takes days from that replacement leave only", async () => {
    const tooMany = await request(app).post("/api/me/leave").set(auth(staffToken))
      .field("type", "Replacement").field("replacementId", sukma).field("from", "2027-01-11").field("to", "2027-01-13").field("reason", "Rest");
    expect(tooMany.status).toBe(400);
    const late = await request(app).post("/api/me/leave").set(auth(staffToken))
      .field("type", "Replacement").field("replacementId", sukma).field("from", "2027-07-01").field("to", "2027-07-01").field("reason", "Rest");
    expect(late.body.code).toBe("REPLACEMENT_EXPIRED");
    const ok = await request(app).post("/api/me/leave").set(auth(staffToken))
      .field("type", "Replacement").field("replacementId", sukma).field("from", "2027-01-11").field("to", "2027-01-11").field("reason", "Rest");
    expect(ok.status).toBe(201);
    expect(ok.body.application.typeLabel).toBe("Replacement Leave SUKMA");
    const before = (await request(app).get("/api/me/leave").set(auth(staffToken))).body;
    const blocked = await request(app).delete(`/api/admin/replacement-leaves/${sukma}`).set(auth(adminToken));
    expect(blocked.status).toBe(400);
    const appr = await request(app).patch(`/api/admin/leave/${ok.body.application.id}/status`).set(auth(adminToken)).send({ status: "Approved" });
    expect(appr.status).toBe(200);
    const after = (await request(app).get("/api/me/leave").set(auth(staffToken))).body;
    expect(after.replacement[0].balance).toBe(1);
    expect(after.balance).toEqual(before.balance); // Annual etc. untouched
  });

  it("expired entries can't be used; admin can change who has it and delete it", async () => {
    const old = await request(app).post("/api/admin/replacement-leaves").set(auth(adminToken))
      .send({ name: "Replacement Leave Jubli Selangor", days: 1, expiresOn: "2020-01-31", usernames: ["nurin"] });
    const jubli = old.body.replacementLeaves.find((x: any) => x.name.includes("Jubli"));
    expect(jubli.staff.map((s: any) => s.username)).toEqual(["nurin"]);
    const r = await request(app).post("/api/me/leave").set(auth(staffToken))
      .field("type", "Replacement").field("replacementId", jubli.id).field("from", "2027-02-01").field("to", "2027-02-01").field("reason", "Rest");
    expect(r.body.code).toBe("REPLACEMENT_EXPIRED");
    const upd = await request(app).put(`/api/admin/replacement-leaves/${jubli.id}`).set(auth(adminToken))
      .send({ name: "Replacement Leave Jubli Selangor", days: 1, expiresOn: "2020-01-31", usernames: [] });
    expect(upd.body.replacementLeaves.find((x: any) => x.id === jubli.id).staff).toHaveLength(0);
    expect((await request(app).delete(`/api/admin/replacement-leaves/${sukma}`).set(auth(adminToken))).status).toBe(200);
    const mine = (await request(app).get("/api/me/leave").set(auth(staffToken))).body;
    expect(mine.replacement).toHaveLength(0);
    // History still shows which replacement leave was taken.
    expect(mine.applications.some((a: any) => a.typeLabel === "Replacement Leave SUKMA")).toBe(true);
  });
});

describe("leave balance settings", () => {
  it("new defaults apply to new staff and add the difference for chosen staff", async () => {
    const before = (await request(app).get("/api/me/leave").set(auth(staffToken))).body.balance;
    const cur = (await request(app).get("/api/admin/settings").set(auth(adminToken))).body.settings.defaultLeave;
    const r = await request(app).put("/api/admin/settings").set(auth(adminToken))
      .send({ defaultLeave: { ...cur, Annual: cur.Annual + 2 }, applyTo: ["nurin", "admin"] });
    expect(r.status).toBe(200);
    expect(r.body.updatedStaff).toBe(1); // admins are never changed
    const after = (await request(app).get("/api/me/leave").set(auth(staffToken))).body.balance;
    expect(after.Annual).toBe(before.Annual + 2);
    expect(after.Medical).toBe(before.Medical);
    const reg = await request(app).post("/api/auth/register").send({
      name: "New Joiner", username: "new.joiner", password: "Passw0rd!x", email: "", role: "Clerk",
      companyId: "yes-empire-group", departmentId: (await request(app).get("/api/public/departments")).body.departments[0].id,
    });
    expect(reg.status).toBe(201);
    const nj = (await request(app).get("/api/me/leave").set(auth(reg.body.token))).body.balance;
    expect(nj.Annual).toBe(cur.Annual + 2);
  });

  it("admin edits one staff member's balance", async () => {
    const r = await request(app).patch("/api/admin/employees/nurin").set(auth(adminToken))
      .send({ leaveBalance: { Annual: 20, Medical: 10, Emergency: 5 } });
    expect(r.status).toBe(200);
    const b = (await request(app).get("/api/me/leave").set(auth(staffToken))).body.balance;
    expect(b).toEqual({ Annual: 20, Medical: 10, Emergency: 5 });
  });
});

describe("add leave days to chosen staff", () => {
  it("adds Annual days only to ticked staff, and replacement leave needs no reason", async () => {
    const before = (await request(app).get("/api/me/leave").set(auth(staffToken))).body.balance;
    const r = await request(app).post("/api/admin/leave-balances/add").set(auth(adminToken))
      .send({ type: "Annual", days: 3, usernames: ["nurin"] });
    expect(r.status).toBe(200);
    expect(r.body.updatedStaff).toBe(1);
    const after = (await request(app).get("/api/me/leave").set(auth(staffToken))).body.balance;
    expect(after.Annual).toBe(before.Annual + 3);
    expect((await request(app).post("/api/admin/leave-balances/add").set(auth(staffToken)).send({ type: "Annual", days: 1, usernames: ["nurin"] })).status).toBe(403);
    const noReason = await request(app).post("/api/me/leave").set(auth(staffToken))
      .field("type", "Annual").field("from", "2027-03-01").field("to", "2027-03-01");
    expect(noReason.status).toBe(400);
    const rep = await request(app).post("/api/admin/replacement-leaves").set(auth(adminToken))
      .send({ name: "Replacement Leave Test", days: 1, usernames: ["nurin"] });
    const id = rep.body.replacementLeaves.find((x: any) => x.name === "Replacement Leave Test").id;
    const ok = await request(app).post("/api/me/leave").set(auth(staffToken))
      .field("type", "Replacement").field("replacementId", id).field("from", "2027-03-02").field("to", "2027-03-02");
    expect(ok.status).toBe(201);
  });
});

describe("missed clock-out", () => {
  it("an earlier day without clock-out shows Missed Clock-Out and HR can set the time", async () => {
    const nurin = await db("users").where({ username: "nurin" }).first();
    // Clocked in at 08:20 Malaysia time on an old day and forgot to clock out.
    await db("attendance").insert({
      id: "missed-1", user_id: nurin.id, date: "2026-09-01",
      clock_in: "2026-09-01T00:20:00.000Z", location: "Office", clock_out_location: "",
    });
    const before = await request(app).get("/api/admin/attendance/employee/nurin").set(auth(adminToken));
    const row = before.body.rows.find((r: any) => r.record.id === "missed-1");
    expect(row.status).toBe("Missed Clock-Out");
    expect((await request(app).patch("/api/admin/attendance/missed-1/clock-out").set(auth(staffToken)).send({ time: "17:30" })).status).toBe(403);
    expect((await request(app).patch("/api/admin/attendance/missed-1/clock-out").set(auth(adminToken)).send({ time: "07:00" })).status).toBe(400);
    expect((await request(app).patch("/api/admin/attendance/missed-1/clock-out").set(auth(adminToken)).send({ time: "5pm" })).status).toBe(400);
    const r = await request(app).patch("/api/admin/attendance/missed-1/clock-out").set(auth(adminToken)).send({ time: "17:30" });
    expect(r.status).toBe(200);
    expect(r.body.row.record.clockOut).toBe("2026-09-01T09:30:00.000Z"); // 17:30 in Malaysia
    expect(r.body.row.record.clockOutByAdmin).toBe("admin");
    expect(r.body.row.status).toBe("Present");
    const n = await request(app).get("/api/notifications").set(auth(staffToken));
    expect(n.body.notifications.some((x: any) => x.title === "Clock-Out Time Added")).toBe(true);
  });
});
