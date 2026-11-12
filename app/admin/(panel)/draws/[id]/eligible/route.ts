import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { isUuid } from "@/lib/attempts";
import { csvCell } from "@/lib/csv";
import { fmtBd } from "@/lib/time";
import { genderLabel } from "@/lib/studentAgg";
import { admissionLabel } from "@/lib/admission";
import { loadEligible } from "@/lib/eligible";

// Everyone who finished a quiz inside this draw's dates, one row each, best score. For small gifts.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) return new NextResponse("Not found", { status: 404 });

  const result = await loadEligible(id);
  if (!result) return new NextResponse("Not found", { status: 404 });

  const header = [
    "Name", "Phone", "Gender", "Admission type", "Center (best quiz)", "Best score", "Out of", "Percent",
    "Quizzes finished in dates", "Qualifies for", "Won in this draw", "Won an earlier draw",
    "In this draw's pool", "Best quiz finished at",
  ];
  const lines = [header.map(csvCell).join(",")];
  for (const r of result.rows) {
    lines.push([
      r.name, r.phone, genderLabel(r.gender), admissionLabel(r.admissionType), r.center, r.score, r.total, r.percent,
      r.quizzes, r.qualifiesFor.join("; "), r.wonGroups.join("; "), r.wonEarlier ? "Yes" : "No",
      r.inPool ? "Yes" : "No", fmtBd(r.bestAt),
    ].map(csvCell).join(","));
  }

  // BOM so Excel reads Bangla names correctly.
  return new NextResponse("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="eligible-students-${id.slice(0, 8)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
