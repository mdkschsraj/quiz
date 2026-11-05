import { db } from "./supabase";

// Extra time allowed for network lag when a submit arrives right at the deadline.
export const GRACE_MS = 5000;

export type Attempt = {
  id: string;
  student_id: string;
  center_id: string;
  week_id: string;
  question_ids: string[];
  answers: Record<string, number>;
  started_at: string;
  expires_at: string;
  submitted_name: string;
  submitted_at: string | null;
  status: "in_progress" | "submitted" | "expired";
  score: number | null;
  total: number | null;
};

export function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

export async function getAttempt(id: string): Promise<Attempt | null> {
  if (!isUuid(id)) return null;
  const { data } = await db().from("attempts").select("*").eq("id", id).maybeSingle();
  return (data as Attempt) ?? null;
}

// Scores the saved answers and closes the attempt exactly once.
// The conditional update (status = 'in_progress') makes concurrent submits safe:
// only one caller wins, everyone else just reads the stored result.
export async function finalizeAttempt(id: string, reason: "submitted" | "expired"): Promise<Attempt | null> {
  const attempt = await getAttempt(id);
  if (!attempt) return null;
  if (attempt.status !== "in_progress") return attempt;

  const { data: qs, error } = await db()
    .from("questions")
    .select("id, correct_index")
    .in("id", attempt.question_ids);
  if (error || !qs) throw new Error("Could not load questions for scoring");

  const correct = new Map<string, number>(qs.map((q: { id: string; correct_index: number }) => [q.id, q.correct_index]));
  let score = 0;
  for (const qid of attempt.question_ids) {
    if (attempt.answers[qid] !== undefined && attempt.answers[qid] === correct.get(qid)) score++;
  }
  const total = attempt.question_ids.length;

  const { data: won } = await db()
    .from("attempts")
    .update({ status: reason, submitted_at: new Date().toISOString(), score, total })
    .eq("id", id)
    .eq("status", "in_progress")
    .select("*")
    .maybeSingle();

  if (won) {
    // First finalized attempt of the week becomes the eligible entry.
    // The unique (student_id, week_id) constraint blocks any second entry.
    await db()
      .from("entries")
      .upsert(
        { student_id: attempt.student_id, week_id: attempt.week_id, attempt_id: id, score, total },
        { onConflict: "student_id,week_id", ignoreDuplicates: true }
      );
    return won as Attempt;
  }
  return getAttempt(id);
}

// Lazily closes an attempt whose time has run out.
export async function finalizeIfExpired(attempt: Attempt): Promise<Attempt> {
  if (attempt.status === "in_progress" && Date.now() > new Date(attempt.expires_at).getTime() + GRACE_MS) {
    return (await finalizeAttempt(attempt.id, "expired")) ?? attempt;
  }
  return attempt;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
