// Public base URL used inside QR codes. Empty string when not configured.
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/+$/, "");
}

export function centerLink(slug: string): string | null {
  const site = siteUrl();
  return site ? `${site}/c/${slug}` : null;
}
