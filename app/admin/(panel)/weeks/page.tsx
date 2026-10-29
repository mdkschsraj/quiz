import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin";

// datetime-local values carry no zone; the campaign runs on Bangladesh time (UTC+6).
function bdToIso(local: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  const d = new Date(`${local}:00+06:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function fmtBd(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" });
}

async function addWeek(formData: FormData) {
  "use server";
  await requireAdmin();
  const label = String(formData.get("label") ?? "").trim();
  const starts = bdToIso(String(formData.get("starts_at") ?? ""));
  const ends = bdToIso(String(formData.get("ends_at") ?? ""));
  const minutes = Number(formData.get("minutes"));
  const count = Number(formData.get("count"));
  const back = (m: string) => redirect("/admin/weeks?msg=" + encodeURIComponent(m));

  if (!label) back("Enter a label.");
  if (!starts || !ends || new Date(ends!) <= new Date(starts!)) back("Check the start and end dates.");
  if (!(minutes >= 1 && minutes <= 60)) back("Duration must be 1 to 60 minutes.");
  if (!(Number.isInteger(count) && count >= 1 && count <= 100)) back("Questions per quiz must be 1 to 100.");

  const { error } = await db().from("campaign_weeks").insert({
    label, starts_at: starts, ends_at: ends,
    quiz_duration_seconds: Math.round(minutes * 60), questions_per_quiz: count,
  });
  if (error) back("Could not add the week.");
  revalidatePath("/admin/weeks");
  back("Week added.");
}

async function toggleWeek(formData: FormData) {
  "use server";
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  await db().from("campaign_weeks").update({ active: !active }).eq("id", id);
  revalidatePath("/admin/weeks");
}

export default async function WeeksPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requireAdmin();
  const { msg } = await searchParams;
  const { data: weeks } = await db().from("campaign_weeks").select("*").order("starts_at", { ascending: false });
  const now = Date.now();

  return (
    <>
      <h1>Campaign weeks</h1>
      {msg && <div className="notice" role="status">{msg}</div>}

      <div className="card">
        <h2>Add week</h2>
        <form action={addWeek}>
          <div className="row">
            <div><label htmlFor="label">Label</label><input id="label" name="label" type="text" placeholder="Week 2" required /></div>
            <div><label htmlFor="starts_at">Starts (Bangladesh time)</label><input id="starts_at" name="starts_at" type="datetime-local" required /></div>
            <div><label htmlFor="ends_at">Ends (Bangladesh time)</label><input id="ends_at" name="ends_at" type="datetime-local" required /></div>
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <div><label htmlFor="minutes">Quiz time (minutes)</label><input id="minutes" name="minutes" type="number" min={1} max={60} step="any" defaultValue={5} required /></div>
            <div><label htmlFor="count">Questions per quiz</label><input id="count" name="count" type="number" min={1} max={100} defaultValue={10} required /></div>
            <div style={{ flex: "0 0 auto" }}><button className="smallbtn" type="submit">Add week</button></div>
          </div>
        </form>
        <p className="muted" style={{ marginTop: 10 }}>
          Only one active week should cover any moment in time. Students taking the quiz are matched to the newest active week that is currently running.
        </p>
      </div>

      <div className="card" style={{ overflowX: "auto" }}>
        <table className="t">
          <thead><tr><th>Week</th><th>Runs</th><th>Quiz</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {(weeks ?? []).map((w: { id: string; label: string; starts_at: string; ends_at: string; quiz_duration_seconds: number; questions_per_quiz: number; active: boolean }) => {
              const live = w.active && now >= new Date(w.starts_at).getTime() && now <= new Date(w.ends_at).getTime();
              return (
                <tr key={w.id}>
                  <td>{w.label}</td>
                  <td>{fmtBd(w.starts_at)} to {fmtBd(w.ends_at)}</td>
                  <td>{w.questions_per_quiz} questions, {Math.round(w.quiz_duration_seconds / 60 * 10) / 10} min</td>
                  <td>{live ? <span className="badge ok">Live now</span> : w.active ? "Scheduled/ended" : "Off"}</td>
                  <td>
                    <form action={toggleWeek}>
                      <input type="hidden" name="id" value={w.id} />
                      <input type="hidden" name="active" value={String(w.active)} />
                      <button className="smallbtn" type="submit">{w.active ? "Turn off" : "Turn on"}</button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
