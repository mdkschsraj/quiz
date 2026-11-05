import { db } from "./supabase";
import { bestAttempts, selectWinners } from "./draw";
import { chunk, fetchAll } from "./drawData";

async function rollback(drawId: string) {
  const s = db();
  await s.from("draw_winners").delete().eq("draw_id", drawId);
  await s.from("draw_entries").delete().eq("draw_id", drawId);
  await s.from("draw_groups").update({ eligible_count: null }).eq("draw_id", drawId);
  await s.from("draws").update({ status: "draft", drawn_at: null }).eq("id", drawId);
}

// Admin escape hatch if a run was interrupted and the draw is stuck in "drawing".
export async function resetStuckDraw(drawId: string): Promise<string> {
  const { data } = await db().from("draws").select("status").eq("id", drawId).maybeSingle();
  if (!data) return "Draw not found.";
  if (data.status !== "drawing") return "This draw is not stuck.";
  await rollback(drawId);
  return "Draw reset. You can run it again.";
}

// Runs the draw once. Returns a message for the admin.
export async function executeDraw(drawId: string): Promise<string> {
  const s = db();
  const { data: draw } = await s.from("draws").select("*").eq("id", drawId).maybeSingle();
  if (!draw) return "Draw not found.";

  const { data: groupRows } = await s.from("draw_groups")
    .select("id, name, min_percent, winners_count").eq("draw_id", drawId);
  if (!groupRows || groupRows.length === 0) return "Add at least one group first.";

  // Claim the draw so two clicks (or two admins) cannot run it twice.
  const { data: claimed } = await s.from("draws").update({ status: "drawing" })
    .eq("id", drawId).eq("status", "draft").select("id").maybeSingle();
  if (!claimed) return "This draw has already been run.";

  try {
    const attempts = await fetchAll<{ id: string; student_id: string; score: number; total: number; submitted_at: string }>(
      (from, to) => s.from("attempts")
        .select("id, student_id, score, total, submitted_at")
        .neq("status", "in_progress").not("score", "is", null)
        .gte("submitted_at", draw.starts_at).lte("submitted_at", draw.ends_at)
        .order("id").range(from, to)
    );

    let excluded = new Set<string>();
    if (!draw.allow_previous_winners) {
      const prev = await fetchAll<{ student_id: string }>(
        (from, to) => s.from("draw_winners").select("student_id").neq("draw_id", drawId).order("id").range(from, to)
      );
      excluded = new Set(prev.map((p) => p.student_id));
    }

    const candidates = bestAttempts(attempts.map((a) => ({
      studentId: a.student_id, attemptId: a.id, score: a.score, total: a.total, submittedAt: a.submitted_at,
    }))).filter((c) => !excluded.has(c.studentId));

    const rules = groupRows.map((g) => ({ id: g.id as string, name: g.name as string, minPercent: g.min_percent as number, winners: g.winners_count as number }));
    const { picks, eligibleCounts } = selectWinners(candidates, rules, draw.allow_multi_group_wins);

    for (const part of chunk(candidates, 500)) {
      const { error } = await s.from("draw_entries").insert(part.map((c) => ({
        draw_id: drawId, student_id: c.studentId, attempt_id: c.attemptId, score: c.score, total: c.total,
      })));
      if (error) throw new Error(error.message);
    }
    for (const part of chunk(picks, 500)) {
      const { error } = await s.from("draw_winners").insert(part.map((p) => ({
        draw_id: drawId, group_id: p.groupId, student_id: p.studentId, attempt_id: p.attemptId,
        score: p.score, total: p.total, position: p.position,
      })));
      if (error) throw new Error(error.message);
    }
    for (const g of rules) {
      const { error } = await s.from("draw_groups").update({ eligible_count: eligibleCounts[g.id] ?? 0 }).eq("id", g.id);
      if (error) throw new Error(error.message);
    }
    const { error: doneErr } = await s.from("draws")
      .update({ status: "drawn", drawn_at: new Date().toISOString() })
      .eq("id", drawId).eq("status", "drawing");
    if (doneErr) throw new Error(doneErr.message);

    const short = rules.filter((g) => (eligibleCounts[g.id] ?? 0) < g.winners).map((g) => g.name);
    return `Draw complete: ${picks.length} winner(s) selected from ${candidates.length} eligible student(s).` +
      (short.length ? ` Not enough eligible students to fill: ${short.join(", ")}.` : "");
  } catch {
    await rollback(drawId);
    return "The draw failed and was rolled back. Nothing was saved. Please try again.";
  }
}
