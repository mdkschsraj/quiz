import { db } from "./supabase";
import { fetchAll } from "./drawData";
import { isUuid } from "./attempts";
import type { AttemptRow } from "./studentAgg";

export type Filters = {
  from: string;     // YYYY-MM-DD (Bangladesh date) or ""
  to: string;       // YYYY-MM-DD or ""
  center: string;   // center id or ""
  gender: string;   // male | female | unspecified | ""
  status: string;   // started | finished | ""
  view: "unique" | "attempts";
};

export const MAX_ROWS = 50000;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseFilters(sp: Record<string, string | undefined>): Filters {
  const pick = (v: string | undefined, allowed: string[]) => (v && allowed.includes(v) ? v : "");
  return {
    from: DATE.test(sp.from ?? "") ? (sp.from as string) : "",
    to: DATE.test(sp.to ?? "") ? (sp.to as string) : "",
    center: sp.center && isUuid(sp.center) ? sp.center : "",
    gender: pick(sp.gender, ["male", "female", "unspecified"]),
    status: pick(sp.status, ["started", "finished"]),
    view: sp.view === "attempts" ? "attempts" : "unique",
  };
}

export function filtersToQuery(f: Filters): string {
  const p = new URLSearchParams();
  (Object.entries(f) as [string, string][]).forEach(([k, v]) => { if (v) p.set(k, v); });
  return p.toString();
}

type Joined<T> = T | T[] | null;
const one = <T,>(x: Joined<T>): T | null => (Array.isArray(x) ? x[0] ?? null : x);

// Every row here is a click on "Start Quiz": the attempt is created at that moment,
// so people who never finished are included (status "in_progress").
export async function loadAttemptRows(f: Filters): Promise<{ rows: AttemptRow[]; truncated: boolean }> {
  const select = f.gender
    ? "id, student_id, started_at, status, score, total, students!inner(name, phone, gender), centers(name)"
    : "id, student_id, started_at, status, score, total, students(name, phone, gender), centers(name)";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const build = (from: number, to: number): any => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = db().from("attempts").select(select).order("started_at", { ascending: false }).order("id");
    if (f.from) q = q.gte("started_at", new Date(`${f.from}T00:00:00+06:00`).toISOString());
    if (f.to) q = q.lte("started_at", new Date(`${f.to}T23:59:59.999+06:00`).toISOString());
    if (f.center) q = q.eq("center_id", f.center);
    if (f.status === "started") q = q.eq("status", "in_progress");
    if (f.status === "finished") q = q.neq("status", "in_progress");
    if (f.gender === "male" || f.gender === "female") q = q.eq("students.gender", f.gender);
    if (f.gender === "unspecified") q = q.is("students.gender", null);
    return q.range(from, to);
  };

  type Raw = {
    student_id: string; started_at: string; status: string; score: number | null; total: number | null;
    students: Joined<{ name: string; phone: string; gender: string | null }>;
    centers: Joined<{ name: string }>;
  };
  const raw = await fetchAll<Raw>(build);
  const truncated = raw.length > MAX_ROWS;
  const rows: AttemptRow[] = raw.slice(0, MAX_ROWS).map((r) => {
    const s = one(r.students);
    return {
      studentId: r.student_id,
      name: s?.name ?? "",
      phone: s?.phone ?? "",
      gender: s?.gender ?? null,
      center: one(r.centers)?.name ?? "",
      startedAt: r.started_at,
      status: r.status,
      score: r.score,
      total: r.total,
    };
  });
  return { rows, truncated };
}
