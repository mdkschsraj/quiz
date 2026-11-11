import { db } from "./supabase";
import { sniffImage } from "./imageType";

export const BUCKET = "campaign-photos";
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // Vercel rejects request bodies above about 4.5 MB

export function publicPhotoUrl(path: string | null | undefined): string | null {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
  if (!path || !base) return null;
  return `${base}/storage/v1/object/public/${BUCKET}/${path}`;
}

// Validates and stores an uploaded image. Returns the storage path or a message for the admin.
export async function storeImage(file: unknown, folder: string): Promise<{ path: string } | { error: string }> {
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image first." };
  if (file.size > MAX_IMAGE_BYTES) return { error: "That image is larger than 4 MB. Use a smaller photo." };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffImage(bytes);
  if (!kind) return { error: "Only JPG, PNG or WebP images are accepted." };

  const path = `${folder}/${crypto.randomUUID()}.${kind.ext}`;
  const { error } = await db().storage.from(BUCKET).upload(path, bytes, { contentType: kind.type, upsert: false });
  if (error) return { error: "Upload failed. Check that migration 005 has been run (it creates the storage bucket)." };
  return { path };
}

export async function removeImage(path: string | null | undefined): Promise<void> {
  if (!path) return;
  try { await db().storage.from(BUCKET).remove([path]); } catch { /* best effort */ }
}
