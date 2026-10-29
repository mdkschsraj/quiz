// Generates one QR code PNG per active coaching center.
// Usage: node --env-file=.env.local scripts/generate-qr.mjs
import { createClient } from "@supabase/supabase-js";
import QRCode from "qrcode";
import { mkdir } from "node:fs/promises";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const site = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
if (!url || !key || !site) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SITE_URL first.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await supabase.from("centers").select("name, slug").eq("active", true);
if (error) { console.error(error.message); process.exit(1); }

await mkdir("qr-codes", { recursive: true });
for (const c of data) {
  const link = `${site}/c/${c.slug}`;
  await QRCode.toFile(`qr-codes/${c.slug}.png`, link, { width: 800, margin: 2, errorCorrectionLevel: "M" });
  console.log(`${c.name}: ${link} -> qr-codes/${c.slug}.png`);
}
