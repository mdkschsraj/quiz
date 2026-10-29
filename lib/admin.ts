import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

export const ADMIN_COOKIE = "admin_token";

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  return Boolean(email) && adminEmails().includes((email as string).toLowerCase());
}

// A throwaway client for auth calls. Never reuse the shared service-role client for
// signInWithPassword: it would attach the user's session to that client.
export function authClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase environment variables are not set");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// Returns the admin's email if the cookie holds a valid session for an allowlisted email.
export async function currentAdmin(): Promise<string | null> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  const { data, error } = await authClient().auth.getUser(token);
  if (error || !data.user) return null;
  return isAdminEmail(data.user.email) ? (data.user.email as string) : null;
}

// Call at the top of every admin page AND every admin server action.
export async function requireAdmin(): Promise<string> {
  const email = await currentAdmin();
  if (!email) redirect("/admin/login");
  return email;
}
