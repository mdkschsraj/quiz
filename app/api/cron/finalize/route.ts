import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { finalizeAttempt, GRACE_MS } from "@/lib/attempts";

// Safety net: closes attempts whose browser disappeared before auto-submitting.
// Also covered lazily whenever a result or quiz page is opened.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cutoff = new Date(Date.now() - GRACE_MS).toISOString();
  const { data } = await db().from("attempts").select("id")
    .eq("status", "in_progress").lt("expires_at", cutoff).limit(500);
  let closed = 0;
  for (const a of data ?? []) {
    await finalizeAttempt(a.id, "expired");
    closed++;
  }
  return NextResponse.json({ closed });
}
