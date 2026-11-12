// Pure helpers for the admin student list (no database access, so they can be unit tested).

export type AttemptRow = {
  studentId: string;
  name: string;
  phone: string;
  gender: string | null;
  admissionType: string | null;
  center: string;
  startedAt: string; // ISO
  status: string;    // in_progress | submitted | expired
  score: number | null;
  total: number | null;
};

export type UniqueRow = {
  studentId: string;
  name: string;
  phone: string;
  gender: string | null;
  admissionType: string | null;
  center: string;       // center of the most recent attempt
  attempts: number;
  finished: number;
  firstStart: string;
  lastStart: string;
  bestScore: number | null;
  bestTotal: number | null;
};

export function statusLabel(status: string): string {
  if (status === "in_progress") return "Started only";
  if (status === "submitted") return "Finished";
  if (status === "expired") return "Time ran out";
  return status;
}

export function genderLabel(g: string | null): string {
  return g === "male" ? "Male" : g === "female" ? "Female" : "Not given";
}

// One row per student. "Started only" attempts count as attempts but not as finished.
export function aggregate(rows: AttemptRow[]): UniqueRow[] {
  const map = new Map<string, UniqueRow>();
  for (const r of rows) {
    const done = r.status !== "in_progress";
    const cur = map.get(r.studentId);
    if (!cur) {
      map.set(r.studentId, {
        studentId: r.studentId, name: r.name, phone: r.phone, gender: r.gender, admissionType: r.admissionType, center: r.center,
        attempts: 1, finished: done ? 1 : 0, firstStart: r.startedAt, lastStart: r.startedAt,
        bestScore: done ? r.score : null, bestTotal: done ? r.total : null,
      });
      continue;
    }
    cur.attempts += 1;
    if (!cur.admissionType && r.admissionType) cur.admissionType = r.admissionType;
    if (done) cur.finished += 1;
    if (r.startedAt < cur.firstStart) cur.firstStart = r.startedAt;
    if (r.startedAt > cur.lastStart) { cur.lastStart = r.startedAt; cur.center = r.center; }
    if (done && r.score !== null && r.total) {
      const better = cur.bestScore === null || cur.bestTotal === null || r.score * cur.bestTotal > cur.bestScore * r.total;
      if (better) { cur.bestScore = r.score; cur.bestTotal = r.total; }
    }
  }
  return [...map.values()].sort((a, b) => (a.lastStart < b.lastStart ? 1 : -1));
}
