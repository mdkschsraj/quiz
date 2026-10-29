import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/supabase";

const VISITOR_COOKIE = "vid";
const DEDUPE_MINUTES = 10;

// Called by the center page after it loads in a real browser (bots and link-preview
// fetchers that do not run JavaScript are therefore not counted).
export async function POST(req: Request) {
  let slug = "";
  try {
    slug = String((await req.json()).slug ?? "").trim();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const supabase = db();
  const { data: center } = await supabase.from("centers").select("id, active").eq("slug", slug).maybeSingle();
  if (!center || !center.active) return NextResponse.json({ ok: false }, { status: 404 });

  const jar = await cookies();
  let visitor = jar.get(VISITOR_COOKIE)?.value;
  if (!visitor || !/^[0-9a-f-]{36}$/i.test(visitor)) {
    visitor = crypto.randomUUID();
    jar.set(VISITOR_COOKIE, visitor, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  // Same visitor re-opening the same center within a few minutes is one scan.
  const since = new Date(Date.now() - DEDUPE_MINUTES * 60 * 1000).toISOString();
  const { data: recent } = await supabase.from("scans").select("id")
    .eq("center_id", center.id).eq("visitor_id", visitor).gte("created_at", since).limit(1);
  if (!recent || recent.length === 0) {
    await supabase.from("scans").insert({ center_id: center.id, visitor_id: visitor });
  }
  return NextResponse.json({ ok: true });
}
