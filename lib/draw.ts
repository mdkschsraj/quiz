import { randomInt } from "node:crypto";

export type Attempt = { studentId: string; attemptId: string; score: number; total: number; submittedAt: string };
export type Candidate = { studentId: string; attemptId: string; score: number; total: number };
export type GroupRule = { id: string; name: string; minPercent: number; winners: number };
export type Pick = { groupId: string; studentId: string; attemptId: string; score: number; total: number; position: number };

// Each student counts once per draw, using their best attempt (highest percentage).
// Ties go to the later submission.
export function bestAttempts(rows: Attempt[]): Candidate[] {
  const best = new Map<string, Attempt>();
  for (const r of rows) {
    if (!(r.total > 0) || r.score < 0 || r.score > r.total) continue;
    const cur = best.get(r.studentId);
    if (!cur) { best.set(r.studentId, r); continue; }
    const better = r.score * cur.total - cur.score * r.total; // compares fractions without floats
    if (better > 0 || (better === 0 && r.submittedAt > cur.submittedAt)) best.set(r.studentId, r);
  }
  return [...best.values()].map(({ studentId, attemptId, score, total }) => ({ studentId, attemptId, score, total }));
}

export function meetsGroup(c: Candidate, minPercent: number): boolean {
  return c.score * 100 >= minPercent * c.total;
}

// Fisher-Yates using a cryptographically secure integer source.
export function secureShuffle<T>(items: T[], rand: (maxExclusive: number) => number = (n) => randomInt(n)): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Groups are drawn strictest first (highest minimum score). When multi-group wins are off,
// a student who already won is removed from the pools of the remaining groups.
export function selectWinners(
  candidates: Candidate[],
  groups: GroupRule[],
  allowMultiGroupWins: boolean,
  rand?: (maxExclusive: number) => number
): { picks: Pick[]; eligibleCounts: Record<string, number> } {
  const ordered = [...groups].sort((a, b) => b.minPercent - a.minPercent);
  const picks: Pick[] = [];
  const eligibleCounts: Record<string, number> = {};
  const alreadyWon = new Set<string>();

  for (const g of ordered) {
    const pool = candidates.filter(
      (c) => meetsGroup(c, g.minPercent) && (allowMultiGroupWins || !alreadyWon.has(c.studentId))
    );
    eligibleCounts[g.id] = pool.length;
    const chosen = secureShuffle(pool, rand).slice(0, g.winners);
    chosen.forEach((c, i) => {
      picks.push({ groupId: g.id, studentId: c.studentId, attemptId: c.attemptId, score: c.score, total: c.total, position: i + 1 });
      alreadyWon.add(c.studentId);
    });
  }
  return { picks, eligibleCounts };
}
