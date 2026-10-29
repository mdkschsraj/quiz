import { NextResponse } from "next/server";
import { finalizeAttempt, getAttempt } from "@/lib/attempts";

// Manual submit, or the browser's automatic submit when its countdown hits zero.
// Scoring always uses the answers already saved on the server.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const attempt = await getAttempt(id);
  if (!attempt) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const expired = Date.now() > new Date(attempt.expires_at).getTime();
  const done = await finalizeAttempt(id, expired ? "expired" : "submitted");
  if (!done) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ status: done.status });
}
