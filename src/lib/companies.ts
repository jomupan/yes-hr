/* Local storage helpers — duplicated from hr-store to avoid a circular import
   (hr-store and departments import from this module during boot). Kept minimal. */
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

export type CompanyType = "parent" | "subsidiary";

export interface Company {
  id: string;
  name: string;
  /** Optional short code, e.g. YES / BAC / BHS. */
  code?: string;
  /** "parent" for the top-level group, "subsidiary" for child companies. */
  type: CompanyType;
  /** Parent company id for subsidiaries; null/undefined for the parent. */
  parentCompanyId?: string | null;
  active: boolean;
  createdAt: string;
}

const COMPANIES_KEY = "hr:companies";
const SEED_FLAG = "hr:companies-seeded";

/* The parent company that already backs every existing department/employee
   in the system (previously a hardcoded "YES EMPIRE Group" string). */
export const PARENT_COMPANY_ID = "yes-empire-group";

const SEED: Omit<Company, "createdAt" | "active">[] = [
  {
    id: PARENT_COMPANY_ID,
    name: "YES EMPIRE Group",
    code: "YES",
    type: "parent",
    parentCompanyId: null,
  },
];

function slugify(s: string): string {
  return (s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function uniqId(name: string, existing: string[]): string {
  let base = slugify(name) || "company";
  let id = base;
  let n = 2;
  while (existing.includes(id)) {
    id = `${base}-${n}`;
    n++;
  }
  return id;
}

/** Ensure the company store exists and is seeded once with the parent. */
export function ensureCompaniesSeeded(): void {
  if (getJSONlocal<boolean>(SEED_FLAG, false)) return;
  const existing = getCompaniesRaw();
  if (existing.length === 0) {
    const now = new Date().toISOString();
    setJSONlocal<Company[]>(
      COMPANIES_KEY,
      SEED.map((c) => ({ ...c, active: true, createdAt: now })),
    );
  }
  setJSONlocal(SEED_FLAG, true);
}

function getCompaniesRaw(): Company[] {
  return getJSONlocal<Company[]>(COMPANIES_KEY, []);
}

/** All companies (active + inactive). */
export function getAllCompanies(): Company[] {
  ensureCompaniesSeeded();
  return getCompaniesRaw().sort((a, b) => a.name.localeCompare(b.name));
}

/** Only active companies — used by the staff registration dropdown. */
export function getActiveCompanies(): Company[] {
  return getAllCompanies().filter((c) => c.active);
}

/** Look up a single company by id (regardless of active state). */
export function getCompanyById(id?: string): Company | undefined {
  if (!id) return undefined;
  return getAllCompanies().find((c) => c.id === id);
}

/** Resolve a company id to its display name, with a safe fallback. */
export function companyNameById(id?: string): string | undefined {
  const c = getCompanyById(id);
  return c?.name;
}

/** Active parent companies — used by the "Parent Company" dropdown. */
export function getActiveParentCompanies(): Company[] {
  return getActiveCompanies().filter((c) => c.type === "parent");
}

export interface CompanySaveResult {
  ok: boolean;
  error?: string;
  company?: Company;
}

/** Add a new company. Name must be unique among active companies. */
export function addCompany(
  name: string,
  code?: string,
  type: CompanyType = "subsidiary",
  parentCompanyId?: string | null,
): CompanySaveResult {
  const cleanName = (name || "").trim();
  if (!cleanName) return { ok: false, error: "Company name is required." };
  const list = getCompaniesRaw();
  const dupeActive = list.some(
    (c) => c.active && c.name.toLowerCase() === cleanName.toLowerCase(),
  );
  if (dupeActive) {
    return { ok: false, error: "A company with that name already exists." };
  }
  // Validate parent when creating a subsidiary.
  if (type === "subsidiary" && parentCompanyId) {
    const parent = list.find((c) => c.id === parentCompanyId);
    if (!parent || !parent.active) {
      return { ok: false, error: "Selected parent company is not available." };
    }
  }
  const id = uniqId(
    cleanName,
    list.map((c) => c.id),
  );
  const company: Company = {
    id,
    name: cleanName,
    code: (code || "").trim() || undefined,
    type,
    parentCompanyId: type === "parent" ? null : parentCompanyId || null,
    active: true,
    createdAt: new Date().toISOString(),
  };
  list.push(company);
  setJSONlocal(COMPANIES_KEY, list);
  return { ok: true, company };
}

/** Edit a company (rename, recode, retype, reparent). Id stays stable. */
export function updateCompany(
  id: string,
  name: string,
  code?: string,
  type?: CompanyType,
  parentCompanyId?: string | null,
): CompanySaveResult {
  const cleanName = (name || "").trim();
  if (!cleanName) return { ok: false, error: "Company name is required." };
  const list = getCompaniesRaw();
  const idx = list.findIndex((c) => c.id === id);
  if (idx === -1) return { ok: false, error: "Company not found." };
  const dupe = list.some(
    (c) =>
      c.id !== id &&
      c.active &&
      c.name.toLowerCase() === cleanName.toLowerCase(),
  );
  if (dupe) {
    return { ok: false, error: "A company with that name already exists." };
  }
  // Prevent a company from being its own parent.
  const resolvedParent = type === "parent" ? null : parentCompanyId || null;
  if (resolvedParent === id) {
    return { ok: false, error: "A company cannot be its own parent." };
  }
  if (resolvedParent) {
    const parent = list.find((c) => c.id === resolvedParent);
    if (!parent)
      return { ok: false, error: "Selected parent company not found." };
  }
  list[idx] = {
    ...list[idx],
    name: cleanName,
    code: (code || "").trim() || undefined,
    type: type || list[idx].type,
    parentCompanyId: resolvedParent,
  };
  setJSONlocal(COMPANIES_KEY, list);
  return { ok: true, company: list[idx] };
}

/** Soft-deactivate a company. It stops appearing for new registrations. */
export function deactivateCompany(id: string): CompanySaveResult {
  const list = getCompaniesRaw();
  const idx = list.findIndex((c) => c.id === id);
  if (idx === -1) return { ok: false, error: "Company not found." };
  list[idx] = { ...list[idx], active: false };
  setJSONlocal(COMPANIES_KEY, list);
  return { ok: true, company: list[idx] };
}

/** Reactivate a previously deactivated company. */
export function reactivateCompany(id: string): CompanySaveResult {
  const list = getCompaniesRaw();
  const idx = list.findIndex((c) => c.id === id);
  if (idx === -1) return { ok: false, error: "Company not found." };
  list[idx] = { ...list[idx], active: true };
  setJSONlocal(COMPANIES_KEY, list);
  return { ok: true, company: list[idx] };
}

/** Hard delete only when there are no departments or employees assigned. */
export function deleteCompanyIfEmpty(
  id: string,
  deptCount: number,
  empCount: number,
): CompanySaveResult {
  if (id === PARENT_COMPANY_ID) {
    return { ok: false, error: "The parent company cannot be deleted." };
  }
  if (deptCount > 0 || empCount > 0) {
    return {
      ok: false,
      error:
        "Cannot delete a company that still has departments or employees assigned.",
    };
  }
  const list = getCompaniesRaw();
  const next = list.filter((c) => c.id !== id);
  if (next.length === list.length) {
    return { ok: false, error: "Company not found." };
  }
  setJSONlocal(COMPANIES_KEY, next);
  return { ok: true };
}
