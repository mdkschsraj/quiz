import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/supabase";
import { finalizeIfExpired, getAttempt } from "@/lib/attempts";

export const dynamic = "force-dynamic";

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = await getAttempt(id);
  if (!found) notFound();

  const attempt = await finalizeIfExpired(found);
  if (attempt.status === "in_progress") redirect(`/quiz/${id}`);

  const supabase = db();
  const [{ data: week }, { data: entry }] = await Promise.all([
    supabase.from("campaign_weeks").select("label, eligible_min_score").eq("id", attempt.week_id).single(),
    supabase.from("entries").select("attempt_id").eq("student_id", attempt.student_id).eq("week_id", attempt.week_id).maybeSingle(),
  ]);

  const score = attempt.score ?? 0;
  const total = attempt.total ?? 0;
  const countedThis = entry?.attempt_id === attempt.id;
  const alreadyEntered = Boolean(entry) && !countedThis;
  const meetsGroup = score >= (week?.eligible_min_score ?? 0);

  return (
    <main>
      <div className="card" style={{ textAlign: "center" }}>
        <h1>Quiz complete</h1>
        <div className="score">{score}/{total}</div>
        {attempt.status === "expired" && <p className="muted">Time ran out, so your saved answers were submitted.</p>}

        {countedThis && (
          <p><span className="badge ok">Entry confirmed</span></p>
        )}
        {alreadyEntered && (
          <p><span className="badge warn">Already entered this week</span></p>
        )}
        <p className="muted">
          {countedThis
            ? `Your participation for ${week?.label ?? "this week"} is recorded.`
            : alreadyEntered
            ? "Your first completed attempt this week is the one that counts for the draw. This attempt does not add another entry."
            : ""}
        </p>
        {countedThis && !meetsGroup && (
          <p className="muted">
            Your score is recorded. Check the campaign rules to see which score groups are included in this week&apos;s draw.
          </p>
        )}
        <p className="muted">Winners are announced on the public draw page according to the campaign rules.</p>
      </div>
    </main>
  );
}
