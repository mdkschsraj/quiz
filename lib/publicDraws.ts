import { db } from "./supabase";
import { loadWinners } from "./drawData";
import { publicPhotoUrl } from "./uploads";

export type NextDraw = {
  id: string;
  name: string;
  drawAt: string;
  prizes: { group: string; prize: string; imageUrl: string | null }[];
};

export type PublicWinner = { name: string; center: string; photoUrl: string | null; delivered: boolean };
export type PublicGroup = { id: string; name: string; prize: string; imageUrl: string | null; winners: PublicWinner[] };
export type PublicDraw = { id: string; name: string; publishedAt: string | null; heldAt: string | null; groups: PublicGroup[] };

// The next announced draw: still a draft, with a live draw time that has not passed
// (shown for up to an hour after, so "starting now" can appear). Never throws: public pages
// must keep working if the optional columns are not there yet.
export async function getNextDraw(): Promise<NextDraw | null> {
  try {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: d } = await db().from("draws").select("id, name, draw_at")
      .eq("status", "draft").not("draw_at", "is", null).gte("draw_at", since)
      .order("draw_at", { ascending: true }).limit(1).maybeSingle();
    if (!d) return null;
    const { data: groups } = await db().from("draw_groups")
      .select("name, prize, prize_image_path").eq("draw_id", d.id)
      .order("min_percent", { ascending: false }).order("created_at");
    return {
      id: d.id,
      name: d.name,
      drawAt: d.draw_at,
      prizes: (groups ?? []).map((g: { name: string; prize: string; prize_image_path: string | null }) => ({
        group: g.name, prize: g.prize, imageUrl: publicPhotoUrl(g.prize_image_path),
      })),
    };
  } catch {
    return null;
  }
}

// Published draws, newest first. A winner's photo is only included when permission was recorded.
export async function getPublishedDraws(limit: number): Promise<PublicDraw[]> {
  try {
    const { data: draws } = await db().from("draws").select("id, name, published_at, drawn_at, draw_at")
      .eq("status", "published").order("published_at", { ascending: false }).limit(limit);
    const out: PublicDraw[] = [];
    for (const d of draws ?? []) {
      const { data: groups } = await db().from("draw_groups")
        .select("id, name, prize, prize_image_path").eq("draw_id", d.id)
        .order("min_percent", { ascending: false }).order("created_at");
      const winners = await loadWinners(d.id);
      out.push({
        id: d.id,
        name: d.name,
        publishedAt: d.published_at,
        heldAt: d.draw_at ?? d.drawn_at ?? d.published_at ?? null, // when the draw took place
        groups: (groups ?? []).map((g: { id: string; name: string; prize: string; prize_image_path: string | null }) => ({
          id: g.id,
          name: g.name,
          prize: g.prize,
          imageUrl: publicPhotoUrl(g.prize_image_path),
          winners: winners
            .filter((w) => w.groupId === g.id)
            .sort((a, b) => a.position - b.position)
            .map((w) => ({
              name: w.name,
              center: w.center,
              photoUrl: w.photoConsent ? publicPhotoUrl(w.photoPath) : null,
              delivered: Boolean(w.deliveredAt),
            })),
        })),
      });
    }
    return out;
  } catch {
    return [];
  }
}

export function countWinners(draw: PublicDraw | undefined): number {
  return draw ? draw.groups.reduce((n, g) => n + g.winners.length, 0) : 0;
}
