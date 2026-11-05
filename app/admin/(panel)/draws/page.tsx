import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin";
import { bdToIso, fmtBd } from "@/lib/time";

async function createDraw(formData: FormData) {
  "use server";
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const starts = bdToIso(String(formData.get("starts_at") ?? ""));
  const ends = bdToIso(String(formData.get("ends_at") ?? ""));
  const multi = formData.get("multi") === "yes";
  const previous = formData.get("previous") === "yes";
  const back = (m: string) => redirect("/admin/draws?msg=" + encodeURIComponent(m));

  if (!name) back("Enter a draw name.");
  if (!starts || !ends || new Date(ends!) <= new Date(starts!)) back("Check the start and end dates.");

  const { data, error } = await db().from("draws").insert({
    name, starts_at: starts, ends_at: ends, allow_multi_group_wins: multi, allow_previous_winners: previous,
  }).select("id").single();
  if (error || !data) back("Could not create the draw.");
  redirect(`/admin/draws/${data!.id}?msg=` + encodeURIComponent("Draw created. Now add its groups."));
}

const STATUS: Record<string, string> = { draft: "Draft", drawing: "Running", drawn: "Drawn (not public)", published: "Published" };

export default async function DrawsPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requireAdmin();
  const { msg } = await searchParams;
  const { data, error } = await db().from("draws")
    .select("id, name, starts_at, ends_at, status").order("created_at", { ascending: false });
  const draws = (data ?? []) as { id: string; name: string; starts_at: string; ends_at: string; status: string }[];

  return (
    <>
      <h1>Draws</h1>
      {msg && <div className="notice" role="status">{msg}</div>}
      {error && <div className="notice" role="alert">Draws are unavailable. Run supabase/migrations/003_draws.sql in the Supabase SQL editor.</div>}

      <div className="card">
        <h2>Create a draw</h2>
        <form action={createDraw}>
          <div className="row">
            <div><label htmlFor="name">Draw name</label><input id="name" name="name" type="text" placeholder="Week 1 Draw" required /></div>
            <div><label htmlFor="starts_at">Quizzes from (Bangladesh time)</label><input id="starts_at" name="starts_at" type="datetime-local" required /></div>
            <div><label htmlFor="ends_at">Quizzes until (Bangladesh time)</label><input id="ends_at" name="ends_at" type="datetime-local" required /></div>
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <div>
              <label htmlFor="multi">Can one student win in more than one group?</label>
              <select id="multi" name="multi" defaultValue="no"><option value="no">No</option><option value="yes">Yes</option></select>
            </div>
            <div>
              <label htmlFor="previous">Can winners of earlier draws win again?</label>
              <select id="previous" name="previous" defaultValue="no"><option value="no">No</option><option value="yes">Yes</option></select>
            </div>
            <div style={{ flex: "0 0 auto" }}><button className="smallbtn" type="submit">Create draw</button></div>
          </div>
        </form>
        <p className="muted" style={{ marginTop: 10 }}>
          Everyone who submitted a quiz inside the date range is in the pool, once, with their best score in that range.
        </p>
      </div>

      <div className="card" style={{ overflowX: "auto" }}>
        <table className="t">
          <thead><tr><th>Draw</th><th>Quiz dates counted</th><th>Status</th></tr></thead>
          <tbody>
            {draws.map((d) => (
              <tr key={d.id}>
                <td><Link href={`/admin/draws/${d.id}`}>{d.name}</Link></td>
                <td>{fmtBd(d.starts_at)} to {fmtBd(d.ends_at)}</td>
                <td>{STATUS[d.status] ?? d.status}</td>
              </tr>
            ))}
            {draws.length === 0 && <tr><td colSpan={3} className="muted">No draws yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
