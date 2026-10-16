import { Router } from "express";
import { db } from "../db/knex";
import { asyncHandler } from "../lib/errors";
import { companyDto, departmentDto } from "./admin/org";

/* Unauthenticated lookups used by the registration form. Active rows only. */
export const publicRouter = Router();

publicRouter.get(
  "/companies",
  asyncHandler(async (_req, res) => {
    const rows = await db("companies").where({ active: true }).orderBy("name");
    res.json({ ok: true, companies: rows.map(companyDto) });
  }),
);

publicRouter.get(
  "/departments",
  asyncHandler(async (req, res) => {
    const q = db("departments as d")
      .join("companies as c", "c.id", "d.company_id")
      .where("d.active", true)
      .select("d.*", "c.name as company_name")
      .orderBy("d.name");
    if (typeof req.query.companyId === "string") q.andWhere("d.company_id", req.query.companyId);
    const rows = await q;
    res.json({ ok: true, departments: rows.map(departmentDto) });
  }),
);

publicRouter.get(
  "/settings",
  asyncHandler(async (_req, res) => {
    const row = await db("settings").where({ key: "companyName" }).first();
    res.json({ ok: true, companyName: row ? JSON.parse(row.value) : "YES Empire Group" });
  }),
);
