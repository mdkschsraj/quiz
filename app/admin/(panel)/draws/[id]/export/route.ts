import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin";
import { isUuid } from "@/lib/attempts";
import { loadWinners } from "@/lib/drawData";

// Spreadsheet programs run cells that start with these characters as formulas.
function cell(v: string | number): string {
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) return new NextResponse("Not found", { status: 404 });

  const { data: draw } = await db().from("draws").select("name, status").eq("id", id).maybeSingle();
  if (!draw || (draw.status !== "drawn" && draw.status !== "published")) {
    return new NextResponse("Draw has no results yet.", { status: 404 });
  }
  const { data: groups } = await db().from("draw_groups").select("id, name, prize").eq("draw_id", id);
  const groupMap = new Map((groups ?? []).map((g: { id: string; name: string; prize: string }) => [g.id, g]));
  const winners = await loadWinners(id);

  const lines = [["Draw", "Group", "Prize", "Position", "Name", "Phone", "Center", "Score", "Total"].map(cell).join(",")];
  for (const w of winners) {
    const g = groupMap.get(w.groupId);
    lines.push([draw.name, g?.name ?? "", g?.prize ?? "", w.position, w.name, w.phone, w.center, w.score, w.total].map(cell).join(","));
  }
  // BOM so Excel reads Bangla names correctly.
  return new NextResponse("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="winners-${id.slice(0, 8)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
