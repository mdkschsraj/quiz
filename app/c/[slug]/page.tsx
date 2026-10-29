import { notFound } from "next/navigation";
import { db } from "@/lib/supabase";
import RegisterForm from "./RegisterForm";
import ScanPing from "./ScanPing";

export const dynamic = "force-dynamic";

export default async function CenterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { data: center } = await db()
    .from("centers").select("name, slug, active").eq("slug", slug).maybeSingle();
  if (!center || !center.active) notFound();

  return (
    <main>
      <ScanPing slug={center.slug} />
      <div className="card">
        <h1>College Quiz Challenge</h1>
        <p>Participate in the quiz and enter the raffle according to the campaign rules.</p>
        <RegisterForm centerSlug={center.slug} centerName={center.name} />
        <p className="muted" style={{ marginTop: 16 }}>
          Your details will be used to manage quiz participation and raffle eligibility.{" "}
          <a href="/privacy">See the campaign privacy notice.</a>
        </p>
      </div>
    </main>
  );
}
