import { Router } from "express";
import { z } from "zod";
import type { Knex } from "knex";
import { db } from "../../db/knex";
import { asyncHandler, badRequest, conflict, notFound, parse } from "../../lib/errors";
import { nowISO } from "../../lib/time";
import { logAudit } from "../../services/audit";
import { PARENT_COMPANY_ID } from "../../db/seed";

export const orgRouter = Router();

/* ───────── DTOs (same shape as frontend Company / Department) ───────── */

export function companyDto(r: any) {
  return {
    id: r.id,
    name: r.name,
    code: r.code ?? undefined,
    type: r.type,
    parentCompanyId: r.parent_company_id ?? null,
    active: !!r.active,
    createdAt: r.created_at,
  };
}

export function departmentDto(r: any) {
  return {
    id: r.id,
    name: r.name,
    code: r.code ?? undefined,
    companyId: r.company_id,
    company: r.company_name ?? "",
    active: !!r.active,
    createdAt: r.created_at,
  };
}

function slugify(s: string): string {
  return (s || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

async function uniqueId(table: string, name: string, fallback: string, trx: Knex = db): Promise<string> {
  const base = slugify(name) || fallback;
  let id = base;
  let n = 2;
  while (await trx(table).where({ id }).first()) id = `${base}-${n++}`;
  return id;
}

/* ───────────── Companies ───────────── */

orgRouter.get(
  "/companies",
  asyncHandler(async (_req, res) => {
    const rows = await db("companies").orderBy("name");
    const [deptCounts, empCounts] = await Promise.all([
      db("departments").select("company_id").count({ n: "*" }).groupBy("company_id"),
      db("users").select("company_id").count({ n: "*" }).groupBy("company_id"),
    ]);
    const d = new Map(deptCounts.map((r: any) => [r.company_id, Number(r.n)]));
    const e = new Map(empCounts.map((r: any) => [r.company_id, Number(r.n)]));
    res.json({
      ok: true,
      companies: rows.map((r) => ({ ...companyDto(r), departmentCount: d.get(r.id) || 0, employeeCount: e.get(r.id) || 0 })),
    });
  }),
);

const companySchema = z.object({
  name: z.string().trim().min(1, "Company name is required.").max(160),
  code: z.string().trim().max(20).optional(),
  type: z.enum(["parent", "subsidiary"]).default("subsidiary"),
  parentCompanyId: z.string().nullable().optional(),
});

async function assertCompanyNameFree(name: string, exceptId?: string) {
  const q = db("companies").where({ active: true }).whereRaw("lower(name) = ?", [name.toLowerCase()]);
  if (exceptId) q.andWhereNot({ id: exceptId });
  if (await q.first()) throw conflict("A company with that name already exists.");
}

orgRouter.post(
  "/companies",
  asyncHandler(async (req, res) => {
    const body = parse(companySchema, req.body);
    await assertCompanyNameFree(body.name);
    const parentId = body.type === "parent" ? null : body.parentCompanyId || null;
    if (parentId) {
      const parent = await db("companies").where({ id: parentId }).first();
      if (!parent || !parent.active) throw badRequest("Selected parent company is not available.");
    }
    const row = {
      id: await uniqueId("companies", body.name, "company"),
      name: body.name,
      code: body.code || null,
      type: body.type,
      parent_company_id: parentId,
      active: true,
      created_at: nowISO(),
    };
    await db("companies").insert(row);
    await logAudit({ action: "company_created", actor: req.user!.username, target: row.id, detail: `Created company ${row.name}.` });
    res.status(201).json({ ok: true, company: companyDto(row) });
  }),
);

orgRouter.put(
  "/companies/:id",
  asyncHandler(async (req, res) => {
    const body = parse(companySchema, req.body);
    const existing = await db("companies").where({ id: req.params.id }).first();
    if (!existing) throw notFound("Company not found.");
    await assertCompanyNameFree(body.name, existing.id);
    const parentId = body.type === "parent" ? null : body.parentCompanyId || null;
    if (parentId === existing.id) throw badRequest("A company cannot be its own parent.");
    if (parentId && !(await db("companies").where({ id: parentId }).first()))
      throw badRequest("Selected parent company not found.");
    const patch = { name: body.name, code: body.code || null, type: body.type, parent_company_id: parentId };
    await db("companies").where({ id: existing.id }).update(patch);
    res.json({ ok: true, company: companyDto({ ...existing, ...patch }) });
  }),
);

orgRouter.post(
  "/companies/:id/:action(deactivate|reactivate)",
  asyncHandler(async (req, res) => {
    const existing = await db("companies").where({ id: req.params.id }).first();
    if (!existing) throw notFound("Company not found.");
    const active = req.params.action === "reactivate";
    if (!active && existing.id === PARENT_COMPANY_ID) throw badRequest("The parent company cannot be deactivated.");
    await db("companies").where({ id: existing.id }).update({ active });
    await logAudit({
      action: `company_${req.params.action}d`,
      actor: req.user!.username,
      target: existing.id,
      detail: `${active ? "Reactivated" : "Deactivated"} company ${existing.name}.`,
    });
    res.json({ ok: true, company: companyDto({ ...existing, active }) });
  }),
);

orgRouter.delete(
  "/companies/:id",
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    if (id === PARENT_COMPANY_ID) throw badRequest("The parent company cannot be deleted.");
    const existing = await db("companies").where({ id }).first();
    if (!existing) throw notFound("Company not found.");
    const [dc, ec, sc] = await Promise.all([
      db("departments").where({ company_id: id }).count({ n: "*" }).first(),
      db("users").where({ company_id: id }).count({ n: "*" }).first(),
      db("companies").where({ parent_company_id: id }).count({ n: "*" }).first(),
    ]);
    if (Number(dc?.n) > 0 || Number(ec?.n) > 0)
      throw badRequest("Cannot delete a company that still has departments or employees assigned.");
    if (Number(sc?.n) > 0) throw badRequest("Cannot delete a company that still has subsidiaries.");
    await db("companies").where({ id }).del();
    await logAudit({ action: "company_deleted", actor: req.user!.username, target: id, detail: `Deleted company ${existing.name}.` });
    res.json({ ok: true });
  }),
);

/* ───────────── Departments ───────────── */

orgRouter.get(
  "/departments",
  asyncHandler(async (req, res) => {
    const q = db("departments as d")
      .leftJoin("companies as c", "c.id", "d.company_id")
      .select("d.*", "c.name as company_name")
      .orderBy("d.name");
    if (typeof req.query.companyId === "string") q.where("d.company_id", req.query.companyId);
    const rows = await q;
    const counts = await db("users").select("department_id").count({ n: "*" }).groupBy("department_id");
    const m = new Map(counts.map((r: any) => [r.department_id, Number(r.n)]));
    res.json({ ok: true, departments: rows.map((r) => ({ ...departmentDto(r), employeeCount: m.get(r.id) || 0 })) });
  }),
);

const deptSchema = z.object({
  name: z.string().trim().min(1, "Department name is required.").max(160),
  companyId: z.string().min(1, "Please select a company."),
  code: z.string().trim().max(20).optional(),
});

async function assertDeptNameFree(name: string, companyId: string, exceptId?: string) {
  const q = db("departments").where({ active: true, company_id: companyId }).whereRaw("lower(name) = ?", [name.toLowerCase()]);
  if (exceptId) q.andWhereNot({ id: exceptId });
  if (await q.first()) throw conflict("A department with that name already exists for this company.");
}

orgRouter.post(
  "/departments",
  asyncHandler(async (req, res) => {
    const body = parse(deptSchema, req.body);
    const company = await db("companies").where({ id: body.companyId }).first();
    if (!company) throw badRequest("Please select a company.");
    await assertDeptNameFree(body.name, body.companyId);
    const row = {
      id: await uniqueId("departments", body.name, "dept"),
      name: body.name,
      code: body.code || null,
      company_id: body.companyId,
      active: true,
      created_at: nowISO(),
    };
    await db("departments").insert(row);
    res.status(201).json({ ok: true, department: departmentDto({ ...row, company_name: company.name }) });
  }),
);

orgRouter.put(
  "/departments/:id",
  asyncHandler(async (req, res) => {
    const body = parse(deptSchema, req.body);
    const existing = await db("departments").where({ id: req.params.id }).first();
    if (!existing) throw notFound("Department not found.");
    const company = await db("companies").where({ id: body.companyId }).first();
    if (!company) throw badRequest("Selected company not found.");
    await assertDeptNameFree(body.name, body.companyId, existing.id);
    const patch = { name: body.name, code: body.code || null, company_id: body.companyId };
    await db("departments").where({ id: existing.id }).update(patch);
    res.json({ ok: true, department: departmentDto({ ...existing, ...patch, company_name: company.name }) });
  }),
);

orgRouter.post(
  "/departments/:id/:action(deactivate|reactivate)",
  asyncHandler(async (req, res) => {
    const existing = await db("departments").where({ id: req.params.id }).first();
    if (!existing) throw notFound("Department not found.");
    const active = req.params.action === "reactivate";
    await db("departments").where({ id: existing.id }).update({ active });
    res.json({ ok: true, department: departmentDto({ ...existing, active }) });
  }),
);

orgRouter.delete(
  "/departments/:id",
  asyncHandler(async (req, res) => {
    const existing = await db("departments").where({ id: req.params.id }).first();
    if (!existing) throw notFound("Department not found.");
    const c = await db("users").where({ department_id: existing.id }).count({ n: "*" }).first();
    if (Number(c?.n) > 0) throw badRequest("Cannot delete a department that still has employees assigned.");
    await db("departments").where({ id: existing.id }).del();
    res.json({ ok: true });
  }),
);
