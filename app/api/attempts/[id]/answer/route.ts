import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { getAttempt, GRACE_MS } from "@/lib/attempts";

// Saves one answer. Rejected once the deadline (plus a small grace) has passed.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: { questionId?: string; choice?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const attempt = await getAttempt(id);
  if (!attempt) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (attempt.status !== "in_progress") {
    return NextResponse.json({ error: "closed" }, { status: 409 });
  }
  if (Date.now() > new Date(attempt.expires_at).getTime() + GRACE_MS) {
    return NextResponse.json({ error: "closed" }, { status: 409 });
  }

  const qid = body.questionId ?? "";
  if (!attempt.question_ids.includes(qid) || !Number.isInteger(body.choice) || (body.choice as number) < 0 || (body.choice as number) > 5) {
    return NextResponse.json({ error: "Invalid answer." }, { status: 400 });
  }

  const answers = { ...attempt.answers, [qid]: body.choice as number };
  await db().from("attempts").update({ answers }).eq("id", id).eq("status", "in_progress");
  return NextResponse.json({ ok: true });
}
