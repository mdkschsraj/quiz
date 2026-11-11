import { fmtBd } from "@/lib/time";
import type { PublicDraw, PublicWinner } from "@/lib/publicDraws";

function Avatar({ w, size }: { w: PublicWinner; size: number }) {
  return w.photoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="wc-photo" src={w.photoUrl} alt={`${w.name}, winner`} width={size} height={size} loading="lazy" decoding="async" />
  ) : (
    <span className="wc-initial" style={{ width: size, height: size }} aria-hidden="true">
      {Array.from(w.name.trim())[0]?.toUpperCase() ?? "?"}
    </span>
  );
}

const firstName = (n: string) => n.trim().split(/\s+/)[0] ?? n;

// Full list: every published draw, grouped by prize.
export function WinnersList({ draws }: { draws: PublicDraw[] }) {
  return (
    <>
      {draws.map((d) => (
        <section className="wc-draw" key={d.id} aria-label={d.name}>
          <h2 className="wc-title">{d.name}</h2>
          {d.publishedAt && <p className="wc-date">{fmtBd(d.publishedAt).split(",")[0]}</p>}
          {d.groups.map((g) => (
            <div key={g.id} className="wc-group">
              <div className="wc-prizehead">
                {g.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={g.imageUrl} alt={`Prize: ${g.prize || g.name}`} width={48} height={48} loading="lazy" decoding="async" />
                )}
                <span><strong>{g.prize || g.name}</strong>{g.prize && <span className="wc-sub"> · {g.name}</span>}</span>
              </div>
              {g.winners.length === 0 && <p className="wc-sub">No eligible students in this group.</p>}
              <ul className="wc-grid">
                {g.winners.map((w, i) => (
                  <li className="wc-card" key={i}>
                    <Avatar w={w} size={72} />
                    <strong>{w.name}</strong>
                    {w.center && <span className="wc-sub">{w.center}</span>}
                    {w.delivered && <span className="wc-badge">Prize delivered</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </>
  );
}

// Compact strip for the registration page: faces and first names from the latest draw.
export function WinnersStrip({ draw }: { draw: PublicDraw }) {
  const all = draw.groups.flatMap((g) => g.winners.map((w) => ({ w, prize: g.prize || g.name })));
  if (all.length === 0) return null;
  const shown = [...all].sort((a, b) => Number(Boolean(b.w.photoUrl)) - Number(Boolean(a.w.photoUrl))).slice(0, 6);
  return (
    <section className="card wc-strip" aria-label="Previous winners">
      <h2>Previous winners</h2>
      <p className="muted" style={{ marginBottom: 12 }}>{draw.name}: real students, real prizes.</p>
      <ul className="wc-row">
        {shown.map(({ w, prize }, i) => (
          <li key={i} className="wc-mini">
            <Avatar w={w} size={56} />
            <strong>{firstName(w.name)}</strong>
            <span className="wc-sub">{prize}</span>
          </li>
        ))}
      </ul>
      <p style={{ margin: "14px 0 0" }}><a href="/winners"><strong>See all winners</strong></a></p>
    </section>
  );
}
