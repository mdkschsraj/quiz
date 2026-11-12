import { fmtBd } from "@/lib/time";
import type { PublicDraw, PublicGroup, PublicWinner } from "@/lib/publicDraws";

const dateOnly = (iso: string) => fmtBd(iso).split(",")[0];

// A medium-sized photo tile. Three fit in a row at every screen width.
function Tile({ w, sub, showBadge }: { w: PublicWinner; sub?: string; showBadge?: boolean }) {
  return (
    <li className="ws-tile">
      <div className="ws-img">
        {w.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={w.photoUrl} alt={`${w.name}, winner`} loading="lazy" decoding="async" />
        ) : (
          <span className="ws-initial" aria-hidden="true">{Array.from(w.name.trim())[0]?.toUpperCase() ?? "?"}</span>
        )}
      </div>
      <strong>{w.name}</strong>
      {sub && <span className="ws-sub">{sub}</span>}
      {showBadge && w.delivered && <span className="wc-badge">Prize delivered</span>}
    </li>
  );
}

const NAMES_PER_GROUP = 8;

function NamesLine({ g }: { g: PublicGroup }) {
  const shown = g.winners.slice(0, NAMES_PER_GROUP).map((w) => w.name);
  const more = g.winners.length - shown.length;
  return (
    <li>
      <strong>{g.prize || g.name}:</strong> {shown.join(", ")}
      {more > 0 && <> and {more} more</>}
    </li>
  );
}

// Full list for the Winners page: every published draw, grouped by prize.
export function WinnersList({ draws }: { draws: PublicDraw[] }) {
  return (
    <>
      {draws.map((d) => (
        <section className="wc-draw" key={d.id} aria-label={d.name}>
          <h2 className="wc-title">{d.name}</h2>
          {d.heldAt && <p className="wc-date">{dateOnly(d.heldAt)}</p>}
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
              <ul className="ws-photos">
                {g.winners.map((w, i) => <Tile key={i} w={w} sub={w.center} showBadge />)}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </>
  );
}

const MAX_PHOTOS = 9; // three rows of three

// Registration page, below the Start Quiz button: the latest draw's name, date, winner count and
// names, then their photos, three per row.
export function WinnersStrip({ draw }: { draw: PublicDraw }) {
  const groups = draw.groups.filter((g) => g.winners.length > 0);
  const total = groups.reduce((n, g) => n + g.winners.length, 0);
  if (total === 0) return null;

  const photos = groups
    .flatMap((g) => g.winners.filter((w) => w.photoUrl).map((w) => ({ w, prize: g.prize || g.name })))
    .slice(0, MAX_PHOTOS);

  return (
    <section className="card ws" aria-label="Previous raffle winners">
      <h2 className="ws-title">Previous raffle: {draw.name}</h2>
      <p className="ws-meta">
        {draw.heldAt ? `Held on ${dateOnly(draw.heldAt)}. ` : ""}
        {total} {total === 1 ? "winner" : "winners"}.
      </p>
      <ul className="ws-names">
        {groups.map((g) => <NamesLine key={g.id} g={g} />)}
      </ul>
      {photos.length > 0 && (
        <ul className="ws-photos">
          {photos.map(({ w, prize }, i) => <Tile key={i} w={w} sub={prize} />)}
        </ul>
      )}
      <p className="ws-more"><a href="/winners"><strong>See all winners</strong></a></p>
    </section>
  );
}
