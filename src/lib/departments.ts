import {
  ensureCompaniesSeeded,
  PARENT_COMPANY_ID,
  companyNameById,
} from "./companies";

/* Local storage helpers — duplicated from hr-store to avoid a circular import
   (hr-store imports from this module during boot). Kept intentionally minimal. */
function rawGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function rawSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}
function getJSONlocal<T>(key: string, fallback: T): T {
  const raw = rawGet(key);
  if (raw === null || raw === undefined) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
function setJSONlocal<T>(key: string, value: T): void {
  rawSet(key, JSON.stringify(value));
}

export interface Department {
  id: string;
  name: string;
  /** Optional short code, e.g. MKT / IT / FIN. */
  code?: string;
  /** Company / subsidiary database id this department belongs to
   *  (the canonical link to the companies store). */
  companyId: string;
  /** Legacy company label — kept for backward compatibility; resolved via
   *  companyId when present. */
  company: string;
  active: boolean;
  createdAt: string;
}

const DEPARTMENTS_KEY = "hr:departments";
const SEED_FLAG = "hr:departments-seeded";
/* One-time migration flag: backfills companyId on departments that were
   created before the companies store existed. */
const MIGRATE_FLAG = "hr:departments-company-migrated";

/* The initial departments, matching the labels already produced by
   deriveDepartment() so existing employees keep a valid department. */
const SEED: Omit<
  Department,
  "createdAt" | "active" | "company" | "companyId"
>[] = [
  { id: "marketing", name: "Marketing", code: "MKT" },
  { id: "it", name: "IT", code: "IT" },
  { id: "finance", name: "Finance", code: "FIN" },
  { id: "human-resources", name: "Human Resources", code: "HR" },
  { id: "sales", name: "Sales", code: "SAL" },
  { id: "administration", name: "Administration", code: "ADM" },
  { id: "operations", name: "Operations", code: "OPS" },
  { id: "executive", name: "Executive", code: "EXC" },
];

function slugify(s: string): string {
  return (s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function uniqId(name: string, existing: string[]): string {
  let base = slugify(name) || "dept";
  let id = base;
  let n = 2;
  while (existing.includes(id)) {
    id = `${base}-${n}`;
    n++;
  }
  return id;
}

/** Ensure the department store exists and is seeded once. */
export function ensureDepartmentsSeeded(): void {
  ensureCompaniesSeeded();
  if (!getJSONlocal<boolean>(SEED_FLAG, false)) {
    const existing = getDepartmentsRaw();
    if (existing.length === 0) {
      const now = new Date().toISOString();
      setJSONlocal<Department[]>(
        DEPARTMENTS_KEY,
        SEED.map((d) => ({
          ...d,
          companyId: PARENT_COMPANY_ID,
          company: "YES EMPIRE Group",
          active: true,
          createdAt: now,
        })),
      );
    }
    setJSONlocal(SEED_FLAG, true);
  }
  // Backfill companyId on any pre-existing departments that lack it.
  if (!getJSONlocal<boolean>(MIGRATE_FLAG, false)) {
    const list = getDepartmentsRaw();
    let changed = false;
    const next = list.map((d) => {
      if (d.companyId) return d;
      changed = true;
      return { ...d, companyId: PARENT_COMPANY_ID };
    });
    if (changed) setJSONlocal(DEPARTMENTS_KEY, next);
    setJSONlocal(MIGRATE_FLAG, true);
  }
}

function getDepartmentsRaw(): Department[] {
  return getJSONlocal<Department[]>(DEPARTMENTS_KEY, []);
}

/** All departments (active + inactive). */
export function getAllDepartments(): Department[] {
  ensureDepartmentsSeeded();
  return getDepartmentsRaw().sort((a, b) => a.name.localeCompare(b.name));
}

/** Only active departments — used by the staff registration dropdown. */
export function getActiveDepartments(): Department[] {
  return getAllDepartments().filter((d) => d.active);
}

/** Active departments belonging to a specific company (by company id). */
export function getActiveDepartmentsByCompany(companyId: string): Department[] {
  return getActiveDepartments().filter((d) => d.companyId === companyId);
}

/** Look up a single department by id (regardless of active state). */
export function getDepartmentById(id?: string): Department | undefined {
  if (!id) return undefined;
  return getAllDepartments().find((d) => d.id === id);
}

/** Resolve a department id to its display name, with a safe fallback. */
export function departmentNameById(id?: string): string | undefined {
  const d = getDepartmentById(id);
  return d?.name;
}

export interface DepartmentSaveResult {
  ok: boolean;
  error?: string;
  department?: Department;
}

/** Add a new department. Name must be unique among active departments of the
 *  same company (two companies may each have a "Marketing" department). */
export function addDepartment(
  name: string,
  companyId: string,
  code?: string,
): DepartmentSaveResult {
  const cleanName = (name || "").trim();
  if (!cleanName) return { ok: false, error: "Department name is required." };
  if (!companyId) {
    return { ok: false, error: "Please select a company." };
  }
  const list = getDepartmentsRaw();
  // Reject exact duplicate names (case-insensitive) among active departments
  // of the SAME company. Different companies may share a department name.
  const dupeActive = list.some(
    (d) =>
      d.active &&
      d.companyId === companyId &&
      d.name.toLowerCase() === cleanName.toLowerCase(),
  );
  if (dupeActive) {
    return {
      ok: false,
      error: "A department with that name already exists for this company.",
    };
  }
  const id = uniqId(
    cleanName,
    list.map((d) => d.id),
  );
  // Resolve the company label for the legacy `company` field.
  const companyLabel = companyNameById(companyId) || "YES EMPIRE Group";
  const dept: Department = {
    id,
    name: cleanName,
    code: (code || "").trim() || undefined,
    companyId,
    company: companyLabel,
    active: true,
    createdAt: new Date().toISOString(),
  };
  list.push(dept);
  setJSONlocal(DEPARTMENTS_KEY, list);
  return { ok: true, department: dept };
}

/** Rename / recode / reassign a department. Id stays stable so existing
 *  employees keep the link. */
export function renameDepartment(
  id: string,
  name: string,
  companyId?: string,
  code?: string,
): DepartmentSaveResult {
  const cleanName = (name || "").trim();
  if (!cleanName) return { ok: false, error: "Department name is required." };
  const list = getDepartmentsRaw();
  const idx = list.findIndex((d) => d.id === id);
  if (idx === -1) return { ok: false, error: "Department not found." };
  const targetCompanyId = companyId || list[idx].companyId;
  // Reject if another active department of the same company already uses
  // this name.
  const dupe = list.some(
    (d) =>
      d.id !== id &&
      d.active &&
      d.companyId === targetCompanyId &&
      d.name.toLowerCase() === cleanName.toLowerCase(),
  );
  if (dupe) {
    return {
      ok: false,
      error: "A department with that name already exists for this company.",
    };
  }
  const companyLabel = companyNameById(targetCompanyId) || list[idx].company;
  list[idx] = {
    ...list[idx],
    name: cleanName,
    companyId: targetCompanyId,
    company: companyLabel,
    code: (code || "").trim() || undefined,
  };
  setJSONlocal(DEPARTMENTS_KEY, list);
  return { ok: true, department: list[idx] };
}

/** Soft-deactivate a department (it stops appearing in the registration
 *  dropdown, but employees already assigned keep their history). */
export function deactivateDepartment(id: string): DepartmentSaveResult {
  const list = getDepartmentsRaw();
  const idx = list.findIndex((d) => d.id === id);
  if (idx === -1) return { ok: false, error: "Department not found." };
  list[idx] = { ...list[idx], active: false };
  setJSONlocal(DEPARTMENTS_KEY, list);
  return { ok: true, department: list[idx] };
}

/** Reactivate a previously deactivated department. */
export function reactivateDepartment(id: string): DepartmentSaveResult {
  const list = getDepartmentsRaw();
  const idx = list.findIndex((d) => d.id === id);
  if (idx === -1) return { ok: false, error: "Department not found." };
  list[idx] = { ...list[idx], active: true };
  setJSONlocal(DEPARTMENTS_KEY, list);
  return { ok: true, department: list[idx] };
}

/** Hard delete only when there are no employees assigned. Used by admin. */
export function deleteDepartmentIfEmpty(
  id: string,
  assignedCount: number,
): DepartmentSaveResult {
  if (assignedCount > 0) {
    return {
      ok: false,
      error: "Cannot delete a department that still has employees assigned.",
    };
  }
  const list = getDepartmentsRaw();
  const next = list.filter((d) => d.id !== id);
  if (next.length === list.length) {
    return { ok: false, error: "Department not found." };
  }
  setJSONlocal(DEPARTMENTS_KEY, next);
  return { ok: true };
}
