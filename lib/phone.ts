// Normalizes Bangladeshi mobile numbers to the canonical 11-digit form 01XXXXXXXXX.
// Accepts: 01712345678, +8801712345678, 8801712345678, 1712345678, with spaces/dashes.
// Returns null when the input is not a valid BD mobile number.
export function normalizePhone(input: string): string | null {
  let digits = (input ?? "").replace(/\D/g, "");
  if (digits.startsWith("00880")) digits = digits.slice(4);
  if (digits.startsWith("880")) digits = digits.slice(3);
  if (digits.length === 10 && digits.startsWith("1")) digits = "0" + digits;
  return /^01[3-9]\d{8}$/.test(digits) ? digits : null;
}

export function normalizeName(input: string): string {
  return (input ?? "").replace(/\s+/g, " ").trim();
}

// Case/space-insensitive comparison used only to flag conflicts for admin review.
export function sameName(a: string, b: string): boolean {
  return normalizeName(a).toLowerCase() === normalizeName(b).toLowerCase();
}
