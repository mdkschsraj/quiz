import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

async function logout() {
  "use server";
  (await cookies()).delete(ADMIN_COOKIE);
  redirect("/admin/login");
}

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const email = await requireAdmin();
  return (
    <>
      <nav className="adminnav">
        <Link href="/admin">Overview</Link>
        <Link href="/admin/centers">Centers</Link>
        <Link href="/admin/weeks">Weeks</Link>
        <Link href="/admin/questions">Questions</Link>
        <Link href="/admin/students">Students</Link>
        <Link href="/admin/draws">Draws</Link>
        <Link href="/admin/flagged">Flagged</Link>
        <span className="spacer" />
        <span className="muted">{email}</span>
        <form action={logout}><button className="linkbtn" type="submit">Sign out</button></form>
      </nav>
      <main className="wide">{children}</main>
    </>
  );
}
