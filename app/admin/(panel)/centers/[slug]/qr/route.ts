import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { db } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin";
import { centerLink } from "@/lib/site";

// GET /admin/centers/<slug>/qr?format=png|svg  (admin only)
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  await requireAdmin();
  const { slug } = await params;
  const format = new URL(req.url).searchParams.get("format") === "svg" ? "svg" : "png";

  const link = centerLink(slug);
  if (!link) {
    return new NextResponse("Set NEXT_PUBLIC_SITE_URL before downloading QR codes.", { status: 400 });
  }
  const { data: center } = await db().from("centers").select("slug").eq("slug", slug).maybeSingle();
  if (!center) return new NextResponse("Not found", { status: 404 });

  const headers = (type: string) => ({
    "Content-Type": type,
    "Content-Disposition": `attachment; filename="qr-${slug}.${format}"`,
    "Cache-Control": "private, no-store",
  });

  if (format === "svg") {
    const svg = await QRCode.toString(link, { type: "svg", margin: 2, errorCorrectionLevel: "M" });
    return new NextResponse(svg, { headers: headers("image/svg+xml") });
  }
  const png = await QRCode.toBuffer(link, { width: 1000, margin: 2, errorCorrectionLevel: "M" });
  return new NextResponse(new Uint8Array(png), { headers: headers("image/png") });
}
