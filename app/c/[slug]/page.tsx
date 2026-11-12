import { notFound } from "next/navigation";
import { db } from "@/lib/supabase";
import RegisterForm from "./RegisterForm";
import ScanPing from "./ScanPing";
import { facebookUrl } from "@/lib/site";
import { fmtBd } from "@/lib/time";
import { countWinners, getNextDraw, getPublishedDraws } from "@/lib/publicDraws";
import { WinnersStrip } from "@/app/_components/WinnerCards";

export const dynamic = "force-dynamic";

export default async function CenterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { data: center } = await db()
    .from("centers").select("name, slug, active").eq("slug", slug).maybeSingle();
  if (!center || !center.active) notFound();

  const [next, past] = await Promise.all([getNextDraw(), getPublishedDraws(1)]);
  const last = past[0];
  const lastCount = countWinners(last);

  return (
    <main>
      <ScanPing slug={center.slug} />
      <div className="card">
        <h1>College Quiz Challenge</h1>
        <p>Participate in the quiz and enter the raffle according to the campaign rules.</p>
        {facebookUrl() && (
          <p>
            <strong>Winners are announced live on <a href={facebookUrl() as string} target="_blank" rel="noopener noreferrer">our Facebook page</a>.</strong>
          </p>
        )}
        {(next || lastCount > 0) && (
          <p className="rg-teaser">
            {lastCount > 0 && <>Last draw: {lastCount} {lastCount === 1 ? "winner" : "winners"}. </>}
            {next && <>Next live draw: {fmtBd(next.drawAt)}.</>}
          </p>
        )}
        <RegisterForm centerSlug={center.slug} />
        <p className="muted" style={{ marginTop: 16 }}>
          Your details will be used to manage quiz participation and raffle eligibility.{" "}
          <a href="/privacy">See the campaign privacy notice.</a>
        </p>
      </div>
      {last && lastCount > 0 && <WinnersStrip draw={last} />}
    </main>
  );
}
