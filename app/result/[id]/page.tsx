import { notFound, redirect } from "next/navigation";
import { finalizeIfExpired, getAttempt } from "@/lib/attempts";
import { facebookUrl } from "@/lib/site";
import { getNextDraw } from "@/lib/publicDraws";
import NextDrawCard from "@/app/_components/NextDrawCard";

export const dynamic = "force-dynamic";

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = await getAttempt(id);
  if (!found) notFound();

  const attempt = await finalizeIfExpired(found);
  if (attempt.status === "in_progress") redirect(`/quiz/${id}`);

  const score = attempt.score ?? 0;
  const total = attempt.total ?? 0;
  const perfect = total > 0 && score === total;
  const first = (attempt.submitted_name ?? "").trim().split(/\s+/)[0]?.slice(0, 24) || "friend";
  const reference = attempt.id.slice(0, 8).toUpperCase();
  const brand = (process.env.NEXT_PUBLIC_BRAND_NAME ?? "").trim() || "College Quiz Challenge";

  const fb = facebookUrl();
  const next = await getNextDraw();
  const share = fb ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(fb)}` : null;

  return (
    <div className="rp">
      <div className="rp-in">
        <article className="rp-ticket" aria-label={`You scored ${score} out of ${total}`}>
          <div className="rp-top">
            <span>{brand}</span>
            <span>Quiz complete</span>
          </div>
          <p className="rp-score" aria-hidden="true">
            <span>{score}</span>
            <span className="rp-of">/{total}</span>
          </p>
          {attempt.status === "expired" && <p className="rp-note">Time ran out, so we submitted your saved answers.</p>}
          <div className="rp-perf" aria-hidden="true" />
          <div className="rp-stub">
            <span>Quiz reference</span>
            <span className="rp-ref">{reference}</span>
          </div>
        </article>

        <section className="rp-msg">
          <h1 className="rp-title">{perfect ? `Perfect score, ${first}.` : `Well played, ${first}.`}</h1>
          <p className="rp-bold">Don&apos;t miss the live winner draw. It happens on our Facebook page.</p>
          <p className="rp-text">
            Your answers are saved. You&apos;ll watch the winners being picked live, together with everyone who took part.
          </p>
          <p className="rp-fair">
            Winners are chosen by computer from everyone who qualifies, and the results are shown publicly.
          </p>

          {next && <NextDrawCard draw={next} />}

          {fb ? (
            <>
              <a className="rp-cta" href={fb} target="_blank" rel="noopener noreferrer">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H7.8v3h2.6V21h3.1z" /></svg>
                Follow us on Facebook
              </a>
              <p className="rp-tip">Turn on notifications so you don&apos;t miss the live draw.</p>
              <p className="rp-spread">
                Know someone who&apos;d enjoy this quiz?{" "}
                <a className="rp-share" href={share ?? fb} target="_blank" rel="noopener noreferrer">Share our page with them.</a>
              </p>
            </>
          ) : (
            <p className="rp-tip">Keep an eye on our Facebook page for the live draw.</p>
          )}
          <p className="rp-tip"><a className="rp-share" href="/winners">See past winners and prizes</a></p>
        </section>
      </div>
    </div>
  );
}
