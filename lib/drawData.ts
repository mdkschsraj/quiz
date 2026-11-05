import { db } from "./supabase";

export type WinnerRow = {
  groupId: string;
  position: number;
  studentId: string;
  name: string;
  phone: string;
  center: string;
  score: number;
  total: number;
};

// Supabase returns at most 1000 rows per request; this walks through all pages.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchAll<T>(make: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: any }>): Promise<T[]> {
  const out: T[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await make(from, from + size - 1);
    if (error) throw new Error(error.message ?? "query failed");
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < size) break;
  }
  return out;
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// 01712345678 -> 017*****678
export function maskPhone(phone: string): string {
  return phone.length >= 7 ? phone.slice(0, 3) + "*".repeat(phone.length - 6) + phone.slice(-3) : "***";
}

export async function loadWinners(drawId: string): Promise<WinnerRow[]> {
  const s = db();
  const { data: w, error } = await s.from("draw_winners")
    .select("group_id, position, student_id, attempt_id, score, total")
    .eq("draw_id", drawId).order("position");
  if (error) throw new Error(error.message);
  const rows = w ?? [];
  if (rows.length === 0) return [];

  const studentIds = [...new Set(rows.map((r) => r.student_id as string))];
  const attemptIds = [...new Set(rows.map((r) => r.attempt_id as string))];

  const students = new Map<string, { name: string; phone: string }>();
  for (const part of chunk(studentIds, 100)) {
    const { data } = await s.from("students").select("id, name, phone").in("id", part);
    for (const x of data ?? []) students.set(x.id, { name: x.name, phone: x.phone });
  }
  const attemptCenter = new Map<string, string>();
  for (const part of chunk(attemptIds, 100)) {
    const { data } = await s.from("attempts").select("id, center_id").in("id", part);
    for (const x of data ?? []) attemptCenter.set(x.id, x.center_id);
  }
  const centerIds = [...new Set(attemptCenter.values())];
  const centers = new Map<string, string>();
  for (const part of chunk(centerIds, 100)) {
    const { data } = await s.from("centers").select("id, name").in("id", part);
    for (const x of data ?? []) centers.set(x.id, x.name);
  }

  return rows.map((r) => ({
    groupId: r.group_id,
    position: r.position,
    studentId: r.student_id,
    name: students.get(r.student_id)?.name ?? "",
    phone: students.get(r.student_id)?.phone ?? "",
    center: centers.get(attemptCenter.get(r.attempt_id) ?? "") ?? "",
    score: r.score,
    total: r.total,
  }));
}
