import Countdown from "./Countdown";
import { fmtBd } from "@/lib/time";
import type { NextDraw } from "@/lib/publicDraws";

// Takes its colours from the surrounding text, so it fits both the result page and the registration page.
export default function NextDrawCard({ draw }: { draw: NextDraw }) {
  const prizes = draw.prizes.filter((p) => p.prize || p.imageUrl);
  return (
    <section className="nd" aria-label="Next live draw">
      <h2 className="nd-title">Next live draw</h2>
      <p className="nd-when">{fmtBd(draw.drawAt)}</p>
      <Countdown target={draw.drawAt} />
      {prizes.length > 0 && (
        <ul className="nd-prizes">
          {prizes.map((p, i) => (
            <li className="nd-prize" key={i}>
              {p.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imageUrl} alt={`Prize: ${p.prize || p.group}`} width={64} height={64} loading="lazy" decoding="async" />
              )}
              <span>
                <strong>{p.prize || p.group}</strong>
                <span className="nd-group">{p.group}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
