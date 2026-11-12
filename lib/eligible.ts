import { db } from "./supabase";
import { fetchAll } from "./drawData";
import { buildEligible } from "./eligibleAgg";
import type { AttemptIn, EligibleRow } from "./eligibleAgg";

type Joined<T> = T | T[] | null;
const one = <T,>(x: Joined<T>): T | null => (Array.isArray(x) ? x[0] ?? null : x);

// Loads every student who finished a quiz inside the draw's dates, ready to export.
// Works before and after the draw is run.
export async function loadEligible(drawId: string): Promise<{ drawName: string; rows: EligibleRow[] } | null> {
  const s = db();
  const { data: draw } = await s.from("draws")
    .select("id, name, starts_at, ends_at, allow_previous_winners").eq("id", drawId).maybeSingle();
  if (!draw) return null;

  const { data: groupRows } = await s.from("draw_groups").select("id, name, min_percent").eq("draw_id", drawId);
  const groups = (groupRows ?? []).map((g: { id: string; name: string; min_percent: number }) => ({
    id: g.id, name: g.name, minPercent: g.min_percent,
  }));
  const groupName = new Map(groups.map((g) => [g.id, g.name]));

  type Raw = {
    id: string; student_id: string; score: number; total: number; submitted_at: string;
    students: Joined<{ name: string; phone: string; gender: string | null; admission_type: string | null }>;
    centers: Joined<{ name: string }>;
  };
  const raw = await fetchAll<Raw>((from, to) => s.from("attempts")
    .select("id, student_id, score, total, submitted_at, students(name, phone, gender, admission_type), centers(name)")
    .neq("status", "in_progress").not("score", "is", null)
    .gte("submitted_at", draw.starts_at).lte("submitted_at", draw.ends_at)
    .order("id").range(from, to));

  const attempts: AttemptIn[] = raw.map((r) => {
    const st = one(r.students);
    return {
      attemptId: r.id, studentId: r.student_id, score: r.score, total: r.total, submittedAt: r.submitted_at,
      name: st?.name ?? "", phone: st?.phone ?? "", gender: st?.gender ?? null, admissionType: st?.admission_type ?? null, center: one(r.centers)?.name ?? "",
    };
  });

  const earlier = await fetchAll<{ student_id: string }>((from, to) =>
    s.from("draw_winners").select("student_id").neq("draw_id", drawId).order("id").range(from, to));
  const mine = await fetchAll<{ student_id: string; group_id: string }>((from, to) =>
    s.from("draw_winners").select("student_id, group_id").eq("draw_id", drawId).order("id").range(from, to));

  const wonByStudent = new Map<string, string[]>();
  for (const w of mine) {
    const list = wonByStudent.get(w.student_id) ?? [];
    list.push(groupName.get(w.group_id) ?? "");
    wonByStudent.set(w.student_id, list);
  }

  const rows = buildEligible(attempts, groups, {
    allowPreviousWinners: Boolean(draw.allow_previous_winners),
    earlierWinnerIds: new Set(earlier.map((e) => e.student_id)),
    wonByStudent,
  });
  return { drawName: draw.name, rows };
}
