import type { Metadata } from "next";
import { facebookUrl } from "@/lib/site";
import { getNextDraw, getPublishedDraws } from "@/lib/publicDraws";
import NextDrawCard from "@/app/_components/NextDrawCard";
import { WinnersList } from "@/app/_components/WinnerCards";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Our winners", description: "Previous raffle draw winners and what is coming next." };

export default async function WinnersPage() {
  const [next, draws] = await Promise.all([getNextDraw(), getPublishedDraws(12)]);
  const fb = facebookUrl();

  return (
    <main className="wide-ish">
      <h1>Our winners</h1>
      <p className="muted">Every draw is held live on our Facebook page. Winners from past draws are listed here.</p>

      {next && <div className="card"><NextDrawCard draw={next} /></div>}

      {draws.length === 0 ? (
        <div className="card"><p>The first draw has not happened yet. Take the quiz to be in it.</p></div>
      ) : (
        <WinnersList draws={draws} />
      )}

      {fb && (
        <p style={{ textAlign: "center", marginTop: 24 }}>
          <a href={fb} target="_blank" rel="noopener noreferrer"><strong>Follow our Facebook page to watch the next live draw</strong></a>
        </p>
      )}
    </main>
  );
}
