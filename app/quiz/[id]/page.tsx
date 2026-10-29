import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/supabase";
import { finalizeIfExpired, getAttempt } from "@/lib/attempts";
import QuizClient from "./QuizClient";

export const dynamic = "force-dynamic";

export default async function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = await getAttempt(id);
  if (!found) notFound();

  const attempt = await finalizeIfExpired(found);
  if (attempt.status !== "in_progress") redirect(`/result/${id}`);

  // Never send correct_index to the browser.
  const { data: rows } = await db()
    .from("questions").select("id, text, options").in("id", attempt.question_ids);
  const byId = new Map((rows ?? []).map((q: { id: string; text: string; options: string[] }) => [q.id, q]));
  const questions = attempt.question_ids
    .map((qid) => byId.get(qid))
    .filter((q): q is { id: string; text: string; options: string[] } => Boolean(q));

  return (
    <QuizClient
      attemptId={id}
      questions={questions}
      initialAnswers={attempt.answers}
      expiresAt={attempt.expires_at}
      serverNow={new Date().toISOString()}
    />
  );
}
