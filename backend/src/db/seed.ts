import { db } from "./knex";
import { config } from "../config";
import { nowISO } from "../lib/time";
import { createUser, newId } from "../services/users";

export const PARENT_COMPANY_ID = "yes-empire-group";

/* Same starting data the frontend seeds into localStorage, so switching to
   the API feels identical. Safe to run repeatedly — only missing rows are added. */
const DEPARTMENTS = [
  { id: "marketing", name: "Marketing", code: "MKT" },
  { id: "it", name: "IT", code: "IT" },
  { id: "finance", name: "Finance", code: "FIN" },
  { id: "human-resources", name: "Human Resources", code: "HR" },
  { id: "sales", name: "Sales", code: "SAL" },
  { id: "administration", name: "Administration", code: "ADM" },
  { id: "operations", name: "Operations", code: "OPS" },
  { id: "executive", name: "Executive", code: "EXC" },
];

export async function seed(): Promise<void> {
  const now = nowISO();

  if (!(await db("companies").where({ id: PARENT_COMPANY_ID }).first())) {
    await db("companies").insert({
      id: PARENT_COMPANY_ID,
      name: "YES EMPIRE Group",
      code: "YES",
      type: "parent",
      parent_company_id: null,
      active: true,
      created_at: now,
    });
  }

  for (const d of DEPARTMENTS) {
    if (!(await db("departments").where({ id: d.id }).first())) {
      await db("departments").insert({ ...d, company_id: PARENT_COMPANY_ID, active: true, created_at: now });
    }
  }

  if (!(await db("settings").where({ key: "companyName" }).first())) {
    await db("settings").insert([
      { key: "companyName", value: JSON.stringify("YES Empire Group") },
      { key: "defaultLeave", value: JSON.stringify(config.rules.defaultLeave) },
    ]);
  }

  if (!(await db("users").where({ username: "admin" }).first())) {
    await createUser({
      username: "admin",
      fullName: "System Administrator",
      jobTitle: "Administrator",
      email: "admin@yesempire.com",
      employeeId: "EMP001",
      password: config.seedAdminPassword,
      authRole: "admin",
      companyId: PARENT_COMPANY_ID,
      departmentId: "administration",
    });
  }

  if (config.seedDemoStaff && !(await db("users").where({ username: "aina" }).first())) {
    const aina = await createUser({
      username: "aina",
      fullName: "Aina",
      jobTitle: "Marketing Executive",
      email: "aina@yesempire.com",
      employeeId: "EMP023",
      password: config.seedStaffPassword,
      authRole: "staff",
      companyId: PARENT_COMPANY_ID,
      departmentId: "marketing",
    });
    await db("evaluations").insert({
      id: newId(),
      user_id: aina.id,
      period: "2025 H2",
      overall: 78,
      categories: JSON.stringify({ Work_Quality: 80, Teamwork: 82, Punctuality: 70, Initiative: 76 }),
      comments: "Consistent performance; punctuality on task submissions can be improved.",
      created_by: "admin",
      created_at: now,
    });
  }
}
