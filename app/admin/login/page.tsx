import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, authClient, currentAdmin, isAdminEmail } from "@/lib/admin";

export const dynamic = "force-dynamic";

async function login(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  // Same message for every failure so the form does not reveal which emails are admins.
  const fail = () => redirect("/admin/login?error=1");
  if (!email || !password || !isAdminEmail(email)) fail();

  const { data, error } = await authClient().auth.signInWithPassword({ email, password });
  if (error || !data.session) fail();

  (await cookies()).set(ADMIN_COOKIE, data.session!.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.min(data.session!.expires_in ?? 3600, 3600),
  });
  redirect("/admin");
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await currentAdmin()) redirect("/admin");
  const { error } = await searchParams;

  return (
    <main>
      <div className="card">
        <h1>Admin sign in</h1>
        <form action={login}>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="text" autoComplete="username" required />
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required
            style={{ width: "100%", padding: 12, fontSize: "1rem", border: "1px solid var(--line)", borderRadius: 10, background: "var(--bg)", color: "var(--ink)" }} />
          {error && <div className="error" role="alert">Sign in failed.</div>}
          <button className="btn" type="submit">Sign in</button>
        </form>
      </div>
    </main>
  );
}
