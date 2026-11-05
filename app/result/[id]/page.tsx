import { notFound, redirect } from "next/navigation";
import { finalizeIfExpired, getAttempt } from "@/lib/attempts";

export const dynamic = "force-dynamic";

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = await getAttempt(id);
  if (!found) notFound();

  const attempt = await finalizeIfExpired(found);
  if (attempt.status === "in_progress") redirect(`/quiz/${id}`);

  const score = attempt.score ?? 0;
  const total = attempt.total ?? 0;

  return (
    <main>
      <div className="card" style={{ textAlign: "center" }}>
        <h1>Quiz complete</h1>
        <div className="score">{score}/{total}</div>
        {attempt.status === "expired" && <p className="muted">Time ran out, so your saved answers were submitted.</p>}
        <p><span className="badge ok">Participation recorded</span></p>
        <p className="muted">
          Whether you are in a draw depends on your score and the campaign rules. You can take part again in later
          draws, and your best score inside a draw&apos;s dates is the one that counts.
        </p>
        <p className="muted">Winners are announced on the public draw page.</p>
      </div>
    </main>
  );
}
