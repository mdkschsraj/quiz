import { bestAttempts, meetsGroup } from "./draw.ts";

export type AttemptIn = {
  attemptId: string;
  studentId: string;
  score: number;
  total: number;
  submittedAt: string;
  name: string;
  phone: string;
  gender: string | null;
  admissionType: string | null;
  center: string;
};

export type GroupIn = { id: string; name: string; minPercent: number };

export type EligibleRow = {
  studentId: string;
  name: string;
  phone: string;
  gender: string | null;
  admissionType: string | null;
  center: string;        // center of the best quiz
  score: number;
  total: number;
  percent: number;       // one decimal
  quizzes: number;       // quizzes finished inside the draw's dates
  qualifiesFor: string[];
  wonGroups: string[];   // groups this student won in THIS draw
  wonEarlier: boolean;   // won a different draw
  inPool: boolean;       // would be (or was) in this draw's pool under its "earlier winners" setting
  bestAt: string;
};

// Everyone who finished a quiz inside the draw's date range, once, using their best score.
export function buildEligible(
  attempts: AttemptIn[],
  groups: GroupIn[],
  opts: { allowPreviousWinners: boolean; earlierWinnerIds: Set<string>; wonByStudent: Map<string, string[]> }
): EligibleRow[] {
  const byAttempt = new Map(attempts.map((a) => [a.attemptId, a]));
  const quizzes = new Map<string, number>();
  for (const a of attempts) quizzes.set(a.studentId, (quizzes.get(a.studentId) ?? 0) + 1);

  const best = bestAttempts(attempts.map((a) => ({
    studentId: a.studentId, attemptId: a.attemptId, score: a.score, total: a.total, submittedAt: a.submittedAt,
  })));

  const rows: EligibleRow[] = [];
  for (const c of best) {
    const a = byAttempt.get(c.attemptId);
    if (!a) continue;
    const wonEarlier = opts.earlierWinnerIds.has(c.studentId);
    rows.push({
      studentId: c.studentId,
      name: a.name,
      phone: a.phone,
      gender: a.gender,
      admissionType: a.admissionType,
      center: a.center,
      score: c.score,
      total: c.total,
      percent: Math.round((c.score / c.total) * 1000) / 10,
      quizzes: quizzes.get(c.studentId) ?? 1,
      qualifiesFor: groups.filter((g) => meetsGroup(c, g.minPercent)).map((g) => g.name),
      wonGroups: opts.wonByStudent.get(c.studentId) ?? [],
      wonEarlier,
      inPool: opts.allowPreviousWinners || !wonEarlier,
      bestAt: a.submittedAt,
    });
  }
  // Highest score first, then by name, so the gift list reads top-down.
  return rows.sort((x, y) => y.percent - x.percent || x.name.localeCompare(y.name));
}
