import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin";
import { bdToIso, fmtBd, isoToBdInput } from "@/lib/time";
import { isUuid } from "@/lib/attempts";
import { loadWinners } from "@/lib/drawData";
import { executeDraw, resetStuckDraw } from "@/lib/drawRun";
import { siteUrl } from "@/lib/site";
import { publicPhotoUrl, removeImage, storeImage } from "@/lib/uploads";

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
  const { data: g } = await db().from("draw_groups").select("prize_image_path").eq("id", groupId).maybeSingle();
  await db().from("draw_groups").delete().eq("id", groupId).eq("draw_id", id);
  await removeImage(g?.prize_image_path);
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
  here(id, publish ? "Published. The public draw page and Winners page are now live." : "Unpublished. The public pages are hidden again.");
}

async function deleteDraw(formData: FormData) {
  "use server";
  await requireAdmin();
  const id = String(formData.get("draw_id") ?? "");
  if (!isUuid(id)) redirect("/admin/draws");
  // Only drafts can be deleted; a drawn draw is a record of who won.
  const { data: groups } = await db().from("draw_groups").select("prize_image_path").eq("draw_id", id);
  const { data: gone } = await db().from("draws").delete().eq("id", id).eq("status", "draft").select("id");
  if (gone && gone.length > 0) for (const g of groups ?? []) await removeImage(g.prize_image_path);
  redirect("/admin/draws?msg=" + encodeURIComponent("Draft draw deleted."));
}

// Live draw date and time shown to students as a countdown. Leave empty to hide the countdown.
async function saveDrawAt(formData: FormData) {
  "use server";
  await requireAdmin();
  const id = String(formData.get("draw_id") ?? "");
  if (!isUuid(id)) redirect("/admin/draws");
  const raw = String(formData.get("draw_at") ?? "").trim();
  const iso = raw ? bdToIso(raw) : null;
  if (raw && !iso) here(id, "Check the live draw date and time.");
  await db().from("draws").update({ draw_at: iso }).eq("id", id);
  revalidatePath(`/admin/draws/${id}`);
  here(id, iso ? "Live draw time saved." : "Live draw time cleared. The countdown is hidden.");
}

async function uploadPrizeImage(formData: FormData) {
  "use server";
  await requireAdmin();
  const id = String(formData.get("draw_id") ?? "");
  const groupId = String(formData.get("group_id") ?? "");
  if (!isUuid(id) || !isUuid(groupId)) redirect("/admin/draws");

  const { data: g } = await db().from("draw_groups").select("id, prize_image_path").eq("id", groupId).eq("draw_id", id).maybeSingle();
  if (!g) return here(id, "Group not found.");
  const stored = await storeImage(formData.get("file"), `prizes/${groupId}`);
  if ("error" in stored) return here(id, stored.error);

  const { error } = await db().from("draw_groups").update({ prize_image_path: stored.path }).eq("id", groupId);
  if (error) { await removeImage(stored.path); return here(id, "Could not save the prize photo."); }
  await removeImage(g.prize_image_path);
  revalidatePath(`/admin/draws/${id}`);
  here(id, "Prize photo saved.");
}

async function uploadWinnerPhoto(formData: FormData) {
  "use server";
  await requireAdmin();
  const id = String(formData.get("draw_id") ?? "");
  const winnerId = String(formData.get("winner_id") ?? "");
  if (!isUuid(id) || !isUuid(winnerId)) redirect("/admin/draws");
  // A simple record that permission was obtained (the guardian's, for a student under 18).
  if (formData.get("consent") !== "yes") return here(id, "Tick the permission box before uploading a winner photo.");

  const { data: w } = await db().from("draw_winners").select("id, photo_path").eq("id", winnerId).eq("draw_id", id).maybeSingle();
  if (!w) return here(id, "Winner not found.");
  const stored = await storeImage(formData.get("file"), `winners/${id}`);
  if ("error" in stored) return here(id, stored.error);

  const { error } = await db().from("draw_winners").update({ photo_path: stored.path, photo_consent: true }).eq("id", winnerId);
  if (error) { await removeImage(stored.path); return here(id, "Could not save the winner photo."); }
  await removeImage(w.photo_path);
  revalidatePath(`/admin/draws/${id}`);
  here(id, "Winner photo saved. It shows on the public Winners page once the draw is published.");
}

async function removeWinnerPhoto(formData: FormData) {
  "use server";
  await requireAdmin();
  const id = String(formData.get("draw_id") ?? "");
  const winnerId = String(formData.get("winner_id") ?? "");
  if (!isUuid(id) || !isUuid(winnerId)) redirect("/admin/draws");
  const { data: w } = await db().from("draw_winners").select("photo_path").eq("id", winnerId).eq("draw_id", id).maybeSingle();
  await db().from("draw_winners").update({ photo_path: null, photo_consent: false }).eq("id", winnerId).eq("draw_id", id);
  await removeImage(w?.photo_path);
  revalidatePath(`/admin/draws/${id}`);
  here(id, "Winner photo removed.");
}

async function setDelivered(formData: FormData) {
  "use server";
  await requireAdmin();
  const id = String(formData.get("draw_id") ?? "");
  const winnerId = String(formData.get("winner_id") ?? "");
  if (!isUuid(id) || !isUuid(winnerId)) redirect("/admin/draws");
  const delivered = formData.get("delivered") === "yes";
  await db().from("draw_winners")
    .update({ prize_delivered_at: delivered ? new Date().toISOString() : null })
    .eq("id", winnerId).eq("draw_id", id);
  revalidatePath(`/admin/draws/${id}`);
  here(id, delivered ? "Marked as prize delivered." : "Prize delivered mark removed.");
}

type Group = { id: string; name: string; min_percent: number; winners_count: number; prize: string; prize_image_path: string | null; eligible_count: number | null };

const thumb: React.CSSProperties = { width: 56, height: 56, objectFit: "cover", borderRadius: 8, border: "1px solid var(--line)" };
const fileInput: React.CSSProperties = { width: "auto", padding: 6, fontSize: "0.85rem" };

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

      <div className="card">
        <h2>Live draw time</h2>
        <form action={saveDrawAt} className="row">
          <input type="hidden" name="draw_id" value={id} />
          <div>
            <label htmlFor="draw_at">Date and time (Bangladesh time)</label>
            <input id="draw_at" name="draw_at" type="datetime-local" defaultValue={isoToBdInput(draw.draw_at)} />
          </div>
          <div style={{ flex: "0 0 auto" }}><button className="smallbtn" type="submit">Save</button></div>
        </form>
        <p className="muted" style={{ marginTop: 8 }}>
          {draw.status === "draft"
            ? "While this draw is still a draft, students see a countdown to this time, with the prizes below, on the result page. Clear the field to hide it."
            : "The countdown is only shown to students while the draw has not been run yet."}
        </p>
      </div>

      <div className="card" style={{ overflowX: "auto" }}>
        <h2>Groups and prizes</h2>
        <table className="t">
          <thead><tr><th>Group</th><th>Minimum score</th><th>Winners</th><th>Prize</th><th>Prize photo</th>{draw.status !== "draft" && <th>Eligible</th>}<th></th></tr></thead>
          <tbody>
            {groups.map((g) => {
              const img = publicPhotoUrl(g.prize_image_path);
              return (
                <tr key={g.id}>
                  <td>{g.name}</td>
                  <td>{g.min_percent === 100 ? "All correct (10/10)" : `${g.min_percent}% or more`}</td>
                  <td>{g.winners_count}</td>
                  <td>{g.prize || <span className="muted">-</span>}</td>
                  <td>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {img && <img src={img} alt={`Prize: ${g.prize || g.name}`} style={thumb} />}
                    <form action={uploadPrizeImage} style={{ marginTop: img ? 6 : 0 }}>
                      <input type="hidden" name="draw_id" value={id} />
                      <input type="hidden" name="group_id" value={g.id} />
                      <input type="file" name="file" accept="image/jpeg,image/png,image/webp" required style={fileInput} aria-label={`Prize photo for ${g.name}`} />
                      <button className="smallbtn" type="submit" style={{ marginTop: 4 }}>{img ? "Replace" : "Upload"}</button>
                    </form>
                  </td>
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
              );
            })}
            {groups.length === 0 && <tr><td colSpan={7} className="muted">No groups yet.</td></tr>}
          </tbody>
        </table>
        <p className="muted" style={{ marginTop: 8 }}>Photos: JPG, PNG or WebP, up to 4 MB.</p>

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
              100% means every question answered correctly, so 10/10 on a 10-question quiz. 90% would include 9/10 and 10/10. Strictest groups are drawn first. After adding a group, upload its prize photo in the table above.
            </p>
          </form>
        )}
      </div>

      <div className="card">
        <h2>Eligible students</h2>
        <p className="muted">
          Everyone who finished a quiz inside this draw&apos;s dates, one row each, with their best score. The file shows which groups each student qualifies for, who won, and who won an earlier draw, so you can use it for small gifts. It works before and after the draw is run. Students who only clicked Start Quiz are not included; use the Students page for them.
        </p>
        <a className="smallbtn" href={`/admin/draws/${id}/eligible`}>Download eligible students (CSV)</a>
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
          <div className="card" style={{ overflowX: "auto" }}>
            <h2>Winners</h2>
            <p className="muted">
              Upload a photo after the prize is handed over. Tick the permission box to confirm the winner agreed (for a student under 18, a parent or guardian). Photos and the &quot;Prize delivered&quot; badge appear on the public Winners page once the draw is published.
            </p>
            {groups.map((g) => {
              const list = winners.filter((w) => w.groupId === g.id);
              return (
                <div key={g.id} style={{ marginBottom: 20 }}>
                  <strong>{g.name}</strong> {g.prize && <span className="muted">· {g.prize}</span>}
                  <span className="muted"> · {list.length} of {g.winners_count} winners from {g.eligible_count ?? 0} eligible</span>
                  <table className="t" style={{ marginTop: 6 }}>
                    <thead><tr><th>#</th><th>Name</th><th>Phone</th><th>Center</th><th>Score</th><th>Photo</th><th>Prize</th></tr></thead>
                    <tbody>
                      {list.map((w) => {
                        const img = publicPhotoUrl(w.photoPath);
                        return (
                          <tr key={w.winnerId}>
                            <td>{w.position}</td><td>{w.name}</td><td>{w.phone}</td><td>{w.center}</td><td>{w.score}/{w.total}</td>
                            <td>
                              {img ? (
                                <>
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={img} alt={`${w.name}, winner`} style={thumb} />
                                  <form action={removeWinnerPhoto} style={{ marginTop: 6 }}>
                                    <input type="hidden" name="draw_id" value={id} />
                                    <input type="hidden" name="winner_id" value={w.winnerId} />
                                    <button className="smallbtn danger" type="submit">Remove photo</button>
                                  </form>
                                </>
                              ) : (
                                <form action={uploadWinnerPhoto}>
                                  <input type="hidden" name="draw_id" value={id} />
                                  <input type="hidden" name="winner_id" value={w.winnerId} />
                                  <input type="file" name="file" accept="image/jpeg,image/png,image/webp" required style={fileInput} aria-label={`Photo of ${w.name}`} />
                                  <label style={{ fontWeight: 400, display: "flex", gap: 6, alignItems: "center", margin: "6px 0", fontSize: "0.85rem" }}>
                                    <input type="checkbox" name="consent" value="yes" style={{ width: 16, height: 16 }} />
                                    Permission to publish this photo
                                  </label>
                                  <button className="smallbtn" type="submit">Upload</button>
                                </form>
                              )}
                            </td>
                            <td>
                              <form action={setDelivered}>
                                <input type="hidden" name="draw_id" value={id} />
                                <input type="hidden" name="winner_id" value={w.winnerId} />
                                <input type="hidden" name="delivered" value={w.deliveredAt ? "no" : "yes"} />
                                {w.deliveredAt && <div className="badge ok" style={{ marginBottom: 6 }}>Delivered {fmtBd(w.deliveredAt)}</div>}
                                <button className="smallbtn" type="submit">{w.deliveredAt ? "Undo" : "Mark delivered"}</button>
                              </form>
                            </td>
                          </tr>
                        );
                      })}
                      {list.length === 0 && <tr><td colSpan={7} className="muted">No eligible students.</td></tr>}
                    </tbody>
                  </table>
                </div>
              );
            })}
            <a className="smallbtn" href={`/admin/draws/${id}/export`}>Download winners (CSV)</a>
          </div>

          <div className="card">
            <h2>Public pages</h2>
            {draw.status === "published" ? (
              <>
                <p>Reveal page: <a href={`/draw/${id}`}>{publicUrl}</a><br />Winners page: <a href="/winners">{siteUrl()}/winners</a></p>
                <form action={setPublished}>
                  <input type="hidden" name="draw_id" value={id} />
                  <input type="hidden" name="publish" value="no" />
                  <button className="smallbtn" type="submit">Unpublish</button>
                </form>
              </>
            ) : (
              <>
                <p className="muted">Nothing is public until you publish. Winners are already decided; the reveal page only shows them with an animation. Publishing also adds this draw to the Winners page, with each winner&apos;s name, center and photo (where uploaded).</p>
                <form action={setPublished}>
                  <input type="hidden" name="draw_id" value={id} />
                  <input type="hidden" name="publish" value="yes" />
                  <button className="btn" type="submit">Publish draw</button>
                </form>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
