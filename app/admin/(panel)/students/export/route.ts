import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { csvCell } from "@/lib/csv";
import { fmtBd } from "@/lib/time";
import { aggregate, genderLabel, statusLabel } from "@/lib/studentAgg";
import { loadAttemptRows, parseFilters } from "@/lib/studentList";

export async function GET(req: Request) {
  await requireAdmin();
  const sp = Object.fromEntries(new URL(req.url).searchParams.entries());
  const f = parseFilters(sp);
  const { rows } = await loadAttemptRows(f);

  const lines: string[] = [];
  if (f.view === "unique") {
    lines.push(["Name", "Phone", "Gender", "Center (latest)", "Starts", "Finished", "Best score", "First started", "Last started"].map(csvCell).join(","));
    for (const u of aggregate(rows)) {
      lines.push([
        u.name, u.phone, genderLabel(u.gender), u.center, u.attempts, u.finished,
        u.bestScore === null ? "" : `${u.bestScore}/${u.bestTotal}`, fmtBd(u.firstStart), fmtBd(u.lastStart),
      ].map(csvCell).join(","));
    }
  } else {
    lines.push(["Name", "Phone", "Gender", "Center", "Started", "Status", "Score"].map(csvCell).join(","));
    for (const r of rows) {
      lines.push([
        r.name, r.phone, genderLabel(r.gender), r.center, fmtBd(r.startedAt), statusLabel(r.status),
        r.status === "in_progress" || r.score === null ? "" : `${r.score}/${r.total}`,
      ].map(csvCell).join(","));
    }
  }

  // BOM so Excel reads Bangla names correctly.
  return new NextResponse("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="students-${f.view}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
