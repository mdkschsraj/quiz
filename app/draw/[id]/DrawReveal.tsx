"use client";

import { useEffect, useMemo, useState } from "react";

export type RevealWinner = { name: string; phone: string; center: string; score: string };
export type RevealGroup = { name: string; prize: string; winners: RevealWinner[] };

// The winners were already chosen and saved by the server. This page only reveals them.
export default function DrawReveal({ title, groups, facebook }: { title: string; groups: RevealGroup[]; facebook?: string | null }) {
  const total = useMemo(() => groups.reduce((n, g) => n + g.winners.length, 0), [groups]);
  const starts = useMemo(() => {
    let n = 0;
    return groups.map((g) => { const s = n; n += g.winners.length; return s; });
  }, [groups]);
  const pool = useMemo(() => groups.flatMap((g) => g.winners.map((w) => w.name)), [groups]);

  const [phase, setPhase] = useState<"idle" | "count" | "reveal" | "done">("idle");
  const [count, setCount] = useState(3);
  const [shown, setShown] = useState(0);
  const [tick, setTick] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    try { setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch { /* ignore */ }
  }, []);

  function start() {
    if (reduced || total === 0) { setShown(total); setPhase("done"); return; }
    setCount(3);
    setShown(0);
    setPhase("count");
  }

  useEffect(() => {
    if (phase !== "count") return;
    if (count === 0) { setPhase("reveal"); return; }
    const t = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, count]);

  useEffect(() => {
    if (phase !== "reveal") return;
    if (shown >= total) { setPhase("done"); return; }
    const cycle = setInterval(() => setTick((t) => t + 1), 90);
    const lock = setTimeout(() => setShown((s) => s + 1), 1600);
    return () => { clearInterval(cycle); clearTimeout(lock); };
  }, [phase, shown, total]);

  return (
    <main className="stage">
      <h1 style={{ textAlign: "center" }}>{title}</h1>

      {phase === "idle" && (
        <div className="card" style={{ textAlign: "center" }}>
          <p>The winners have been selected. Ready to reveal them?</p>
          <button className="btn" onClick={start}>Reveal winners</button>
        </div>
      )}

      {phase === "count" && (
        <div className="countdown" role="status" aria-live="polite">{count > 0 ? count : "Go!"}</div>
      )}

      {(phase === "reveal" || phase === "done") && (
        <>
          {total === 0 && <div className="card">No winners were selected for this draw.</div>}
          {groups.map((g, gi) => (
            <div className="card" key={gi}>
              <h2 style={{ marginBottom: 2 }}>{g.name}</h2>
              {g.prize && <p className="muted">Prize: {g.prize}</p>}
              {g.winners.length === 0 && <p className="muted">No eligible students for this group.</p>}
              {g.winners.map((w, wi) => {
                const idx = starts[gi] + wi;
                const locked = idx < shown;
                const spinning = !locked && idx === shown && phase === "reveal";
                return (
                  <div className={`winner ${locked ? "locked" : ""}`} key={wi} aria-live="polite">
                    <span className="rank">{wi + 1}</span>
                    {locked ? (
                      <span>
                        <strong>{w.name}</strong>
                        <span className="muted"> · {w.phone}{w.center ? ` · ${w.center}` : ""} · {w.score}</span>
                      </span>
                    ) : spinning ? (
                      <span className="spin">{pool[(tick + idx * 7) % pool.length]}</span>
                    ) : (
                      <span className="muted">?</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          {phase === "done" && total > 0 && <p className="muted" style={{ textAlign: "center" }}>Congratulations to all winners!</p>}
          {phase === "done" && facebook && (
            <p style={{ textAlign: "center" }}>
              <a href={facebook} target="_blank" rel="noopener noreferrer"><strong>Follow our Facebook page for the next draw.</strong></a>
            </p>
          )}
        </>
      )}
    </main>
  );
}
