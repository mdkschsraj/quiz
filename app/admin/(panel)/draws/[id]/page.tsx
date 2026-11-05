import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin";
import { fmtBd } from "@/lib/time";
import { isUuid } from "@/lib/attempts";
import { loadWinners } from "@/lib/drawData";
import { executeDraw, resetStuckDraw } from "@/lib/drawRun";
import { siteUrl } from "@/lib/site";

const here = (id: string, m: string) => redirect(`/admin/draws/${id}?msg=` + encodeURIComponent(m));

async function addGroup(formData: FormData) {
  "use server";
  await requireAdmin();
  const id = String(formData.get("draw_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const minPercent = Number(formData.get("min_percent"));
  const winners = Number(formData.get("winners"));
  const prize = String(formData.get("prize") ?? "").trim();
  if (!isUuid(id)) redirect("/admin/draws");
  if (!name) here(id, "Enter a group name.");
  if (!(Number.isInteger(minPercent) && minPercent >= 1 && minPercent <= 100)) here(id, "Minimum score must be 1 to 100 percent.");
  if (!(Number.isInteger(winners) && winners >= 1 && winners <= 1000)) here(id, "Winners must be 1 to 1000.");

  const { data: draw } = await db().from("draws").select("status").eq("id", id).maybeSingle();
  if (!draw || draw.status !== "draft") here(id, "Groups can only be changed before the draw is run.");
  const { error } = await db().from("draw_groups").insert({ draw_id: id, name, min_percent: minPercent, winners_count: winners, prize });
  if (error) here(id, "Could not add the group.");
  revalidatePath(`/admin/draws/${id}`);
  here(id, "Group added.");
}

async function removeGroup(formData: FormData) {
  "use server";
  await requireAdmin();
  const id = String(formData.get("draw_id") ?? "");
  const groupId = String(formData.get("group_id") ?? "");
  if (!isUuid(id) || !isUuid(groupId)) redirect("/admin/draws");
  const { data: draw } = await db().from("draws").select("status").eq("id", id).maybeSingle();
  if (!draw || draw.status !== "draft") here(id, "Groups can only be changed before the draw is run.");
  await db().from("draw_groups").delete().eq("id", groupId).eq("draw_id", id);
  revalidatePath(`/admin/draws/${id}`);
  here(id, "Group removed.");
}

async function runDraw(formData: FormData) {
  "use server";
  await requireAdmin();
  const id = String(formData.get("draw_id") ?? "");
  if (!isUuid(id)) redirect("/admin/draws");
  if (formData.get("confirm") !== "yes") here(id, "Tick the confirmation box to run the draw.");
  const message = await executeDraw(id);
  revalidatePath(`/admin/draws/${id}`);
  here(id, message);
}

async function resetDraw(formData: FormData) {
  "use server";
  await requireAdmin();
  const id = String(formData.get("draw_id") ?? "");
  if (!isUuid(id)) redirect("/admin/draws");
  const message = await resetStuckDraw(id);
  revalidatePath(`/admin/draws/${id}`);
  here(id, message);
}

async function setPublished(formData: FormData) {
  "use server";
  await requireAdmin();
  const id = String(formData.get("draw_id") ?? "");
  const publish = formData.get("publish") === "yes";
  if (!isUuid(id)) redirect("/admin/draws");
  if (publish) {
    await db().from("draws").update({ status: "published", published_at: new Date().toISOString() }).eq("id", id).eq("status", "drawn");
  } else {
    await db().from("draws").update({ status: "drawn", published_at: null }).eq("id", id).eq("status", "published");
  }
  revalidatePath(`/admin/draws/${id}`);
  here(id, publish ? "Published. The public draw page is now live." : "Unpublished. The public page is hidden again.");
}

async function deleteDraw(formData: FormData) {
  "use server";
  await requireAdmin();
  const id = String(formData.get("draw_id") ?? "");
  if (!isUuid(id)) redirect("/admin/draws");
  // Only drafts can be deleted; a drawn draw is a record of who won.
  await db().from("draws").delete().eq("id", id).eq("status", "draft");
  redirect("/admin/draws?msg=" + encodeURIComponent("Draft draw deleted."));
}

type Group = { id: string; name: string; min_percent: number; winners_count: number; prize: string; eligible_count: number | null };

export default async function DrawDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const { msg } = await searchParams;
  if (!isUuid(id)) notFound();

  const { data: draw } = await db().from("draws").select("*").eq("id", id).maybeSingle();
  if (!draw) notFound();
  const { data: groupRows } = await db().from("draw_groups").select("*").eq("draw_id", id).order("min_percent", { ascending: false }).order("created_at");
  const groups = (groupRows ?? []) as Group[];
  const winners = draw.status === "drawn" || draw.status === "published" ? await loadWinners(id) : [];
  const publicUrl = `${siteUrl()}/draw/${id}`;

  return (
    <>
      <p><Link href="/admin/draws">← All draws</Link></p>
      <h1>{draw.name}</h1>
      {msg && <div className="notice" role="status">{msg}</div>}

      <div className="card">
        <div>Counts quizzes submitted <strong>{fmtBd(draw.starts_at)}</strong> to <strong>{fmtBd(draw.ends_at)}</strong> (Bangladesh time).</div>
        <div className="muted" style={{ marginTop: 6 }}>
          One student can win in more than one group: <strong>{draw.allow_multi_group_wins ? "Yes" : "No"}</strong>. Winners of earlier draws can win again: <strong>{draw.allow_previous_winners ? "Yes" : "No"}</strong>.
          Status: <strong>{draw.status}</strong>.
        </div>
      </div>

      <div className="card" style={{ overflowX: "auto" }}>
        <h2>Groups</h2>
        <table className="t">
          <thead><tr><th>Group</th><th>Minimum score</th><th>Winners</th><th>Prize</th>{draw.status !== "draft" && <th>Eligible</th>}<th></th></tr></thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.id}>
                <td>{g.name}</td>
                <td>{g.min_percent === 100 ? "All correct (10/10)" : `${g.min_percent}% or more`}</td>
                <td>{g.winners_count}</td>
                <td>{g.prize || <span className="muted">-</span>}</td>
                {draw.status !== "draft" && <td>{g.eligible_count ?? 0}</td>}
                <td>
                  {draw.status === "draft" && (
                    <form action={removeGroup}>
                      <input type="hidden" name="draw_id" value={id} />
                      <input type="hidden" name="group_id" value={g.id} />
                      <button className="smallbtn danger" type="submit">Remove</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {groups.length === 0 && <tr><td colSpan={6} className="muted">No groups yet.</td></tr>}
          </tbody>
        </table>

        {draw.status === "draft" && (
          <form action={addGroup} style={{ marginTop: 16 }}>
            <input type="hidden" name="draw_id" value={id} />
            <div className="row">
              <div><label htmlFor="name">Group name</label><input id="name" name="name" type="text" defaultValue="10/10 Winners" required /></div>
              <div><label htmlFor="min_percent">Minimum score (%)</label><input id="min_percent" name="min_percent" type="number" min={1} max={100} defaultValue={100} required /></div>
              <div><label htmlFor="winners">Number of winners</label><input id="winners" name="winners" type="number" min={1} max={1000} defaultValue={1} required /></div>
              <div><label htmlFor="prize">Prize</label><input id="prize" name="prize" type="text" placeholder="e.g. Smartphone" /></div>
              <div style={{ flex: "0 0 auto" }}><button className="smallbtn" type="submit">Add group</button></div>
            </div>
            <p className="muted" style={{ marginTop: 8 }}>
              100% means every question answered correctly, so 10/10 on a 10-question quiz. 90% would include 9/10 and 10/10. Strictest groups are drawn first.
            </p>
          </form>
        )}
      </div>

      {draw.status === "draft" && groups.length > 0 && (
        <div className="card">
          <h2>Run the draw</h2>
          <p className="muted">Winners are chosen by the server using a cryptographically secure random generator and saved permanently. A draw can only be run once.</p>
          <form action={runDraw}>
            <input type="hidden" name="draw_id" value={id} />
            <label style={{ fontWeight: 400, display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" name="confirm" value="yes" style={{ width: 18, height: 18 }} />
              I have checked the dates and groups. Run this draw now.
            </label>
            <button className="btn" type="submit">Run draw</button>
          </form>
        </div>
      )}

      {draw.status === "draft" && (
        <form action={deleteDraw}>
          <input type="hidden" name="draw_id" value={id} />
          <button className="smallbtn danger" type="submit">Delete this draft draw</button>
        </form>
      )}

      {draw.status === "drawing" && (
        <div className="card">
          <p>This draw is marked as running. If it has been more than a minute, a run was probably interrupted.</p>
          <form action={resetDraw}>
            <input type="hidden" name="draw_id" value={id} />
            <button className="smallbtn danger" type="submit">Reset stuck draw</button>
          </form>
        </div>
      )}

      {(draw.status === "drawn" || draw.status === "published") && (
        <>
          <div className="card">
            <h2>Winners</h2>
            {groups.map((g) => {
              const list = winners.filter((w) => w.groupId === g.id);
              return (
                <div key={g.id} style={{ marginBottom: 16 }}>
                  <strong>{g.name}</strong> {g.prize && <span className="muted">· {g.prize}</span>}
                  <span className="muted"> · {list.length} of {g.winners_count} winners from {g.eligible_count ?? 0} eligible</span>
                  <table className="t" style={{ marginTop: 6 }}>
                    <thead><tr><th>#</th><th>Name</th><th>Phone</th><th>Center</th><th>Score</th></tr></thead>
                    <tbody>
                      {list.map((w) => (
                        <tr key={w.studentId + w.position}>
                          <td>{w.position}</td><td>{w.name}</td><td>{w.phone}</td><td>{w.center}</td><td>{w.score}/{w.total}</td>
                        </tr>
                      ))}
                      {list.length === 0 && <tr><td colSpan={5} className="muted">No eligible students.</td></tr>}
                    </tbody>
                  </table>
                </div>
              );
            })}
            <a className="smallbtn" href={`/admin/draws/${id}/export`}>Download winners (CSV)</a>
          </div>

          <div className="card">
            <h2>Public draw page</h2>
            {draw.status === "published" ? (
              <>
                <p>Live at <a href={`/draw/${id}`}>{publicUrl}</a></p>
                <form action={setPublished}>
                  <input type="hidden" name="draw_id" value={id} />
                  <input type="hidden" name="publish" value="no" />
                  <button className="smallbtn" type="submit">Unpublish</button>
                </form>
              </>
            ) : (
              <>
                <p className="muted">The public page stays hidden until you publish. Winners are already decided; the page only reveals them with an animation. It shows each winner&apos;s name and a masked phone number.</p>
                <form action={setPublished}>
                  <input type="hidden" name="draw_id" value={id} />
                  <input type="hidden" name="publish" value="yes" />
                  <button className="btn" type="submit">Publish public draw page</button>
                </form>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
