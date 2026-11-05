import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { normalizeName, normalizePhone, sameName } from "@/lib/phone";
import { finalizeIfExpired, shuffle, Attempt } from "@/lib/attempts";

export async function POST(req: Request) {
  let body: { name?: string; phone?: string; centerSlug?: string; gender?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const name = normalizeName(body.name ?? "");
  const phone = normalizePhone(body.phone ?? "");
  const slug = (body.centerSlug ?? "").trim();
  const gender = body.gender === "male" || body.gender === "female" ? body.gender : null; // optional

  if (name.length < 2 || name.length > 80) {
    return NextResponse.json({ error: "Please enter your full name." }, { status: 400 });
  }
  if (!phone) {
    return NextResponse.json({ error: "Please enter a valid Bangladeshi mobile number." }, { status: 400 });
  }

  const supabase = db();

  const { data: center } = await supabase
    .from("centers").select("id, active").eq("slug", slug).maybeSingle();
  if (!center || !center.active) {
    return NextResponse.json({ error: "This coaching center link is not active." }, { status: 404 });
  }

  const nowIso = new Date().toISOString();
  const { data: week } = await supabase
    .from("campaign_weeks")
    .select("id, quiz_duration_seconds, questions_per_quiz")
    .eq("active", true).lte("starts_at", nowIso).gte("ends_at", nowIso)
    .order("starts_at", { ascending: false }).limit(1).maybeSingle();
  if (!week) {
    return NextResponse.json({ error: "No quiz is running right now. Please check back soon." }, { status: 409 });
  }

  // Silent phone matching: create the student only if the number is new.
  const { error: upsertError } = await supabase.from("students")
    .upsert({ phone, name }, { onConflict: "phone", ignoreDuplicates: true });
  if (upsertError) console.error("start: student upsert failed:", upsertError.message);
  const { data: student, error: studentError } = await supabase
    .from("students").select("id, name, name_conflict").eq("phone", phone).single();
  if (!student) {
    console.error("start: student lookup failed:", studentError?.message);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }

  // Optional gender, kept separate so it can never block a student from starting.
  // Only fills an empty value; never overwrites. Errors (for example a column that
  // has not been added yet) are ignored on purpose.
  if (gender) {
    const { error: genderError } = await supabase.from("students")
      .update({ gender }).eq("id", student.id).is("gender", null);
    if (genderError) console.error("start: gender not saved:", genderError.message);
  }

  // Keep the original name; flag a mismatch for admin review instead of overwriting.
  if (!student.name_conflict && !sameName(student.name, name)) {
    await supabase.from("students").update({ name_conflict: true }).eq("id", student.id);
  }

  // Resume an unfinished attempt for this week instead of starting a second one.
  const { data: open } = await supabase
    .from("attempts").select("*")
    .eq("student_id", student.id).eq("week_id", week.id).eq("status", "in_progress")
    .order("started_at", { ascending: false }).limit(1).maybeSingle();
  if (open) {
    const checked = await finalizeIfExpired(open as Attempt);
    if (checked.status === "in_progress") {
      return NextResponse.json({ attemptId: checked.id });
    }
  }

  const { data: pool } = await supabase.from("questions").select("id").eq("active", true);
  if (!pool || pool.length === 0) {
    return NextResponse.json({ error: "The quiz is not ready yet. Please check back soon." }, { status: 409 });
  }
  const picked = shuffle(pool.map((q: { id: string }) => q.id)).slice(0, week.questions_per_quiz);

  const expiresAt = new Date(Date.now() + week.quiz_duration_seconds * 1000).toISOString();
  const { data: attempt, error } = await supabase.from("attempts").insert({
    student_id: student.id,
    center_id: center.id,
    week_id: week.id,
    submitted_name: name,
    question_ids: picked,
    expires_at: expiresAt,
  }).select("id").single();

  if (error || !attempt) {
    console.error("start: attempt insert failed:", error?.message);
    return NextResponse.json({ error: "Could not start the quiz. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ attemptId: attempt.id });
}
