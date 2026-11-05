import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/supabase";
import { isUuid } from "@/lib/attempts";
import { loadWinners, maskPhone } from "@/lib/drawData";
import DrawReveal from "./DrawReveal";
import type { RevealGroup } from "./DrawReveal";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Draw", robots: { index: false, follow: false } };

export default async function PublicDraw({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const { data: draw } = await db().from("draws").select("id, name, status").eq("id", id).maybeSingle();
  if (!draw) notFound();

  if (draw.status !== "published") {
    return (
      <main>
        <div className="card" style={{ textAlign: "center" }}>
          <h1>{draw.name}</h1>
          <p>The winners have not been announced yet. Please check back soon.</p>
        </div>
      </main>
    );
  }

  const { data: groupRows } = await db().from("draw_groups")
    .select("id, name, prize, min_percent").eq("draw_id", id)
    .order("min_percent", { ascending: false }).order("created_at");
  const winners = await loadWinners(id);

  const groups: RevealGroup[] = (groupRows ?? []).map((g: { id: string; name: string; prize: string }) => ({
    name: g.name,
    prize: g.prize,
    winners: winners
      .filter((w) => w.groupId === g.id)
      .sort((a, b) => a.position - b.position)
      .map((w) => ({ name: w.name, phone: maskPhone(w.phone), center: w.center, score: `${w.score}/${w.total}` })),
  }));

  return <DrawReveal title={draw.name} groups={groups} />;
}
