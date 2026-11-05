// Public base URL used inside QR codes. Empty string when not configured.
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/+$/, "");
}

// The campaign's Facebook page. Only https links on facebook.com / fb.com / fb.me are accepted,
// so a typo in the setting can never send students somewhere else.
export const DEFAULT_FACEBOOK_URL = "https://www.facebook.com/schs.rajshahi/";

export function facebookUrl(): string | null {
  const raw = (process.env.NEXT_PUBLIC_FACEBOOK_URL ?? "").trim() || DEFAULT_FACEBOOK_URL;
  try {
    const u = new URL(raw);
    const h = u.hostname.toLowerCase();
    const ok = h === "facebook.com" || h.endsWith(".facebook.com") || h === "fb.com" || h.endsWith(".fb.com") || h === "fb.me";
    return u.protocol === "https:" && ok ? u.toString() : null;
  } catch {
    return null;
  }
}

export function centerLink(slug: string): string | null {
  const site = siteUrl();
  return site ? `${site}/c/${slug}` : null;
}
