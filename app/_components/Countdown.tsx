"use client";

import { useEffect, useState } from "react";
import { splitRemaining } from "@/lib/countdown";

const two = (n: number) => String(n).padStart(2, "0");

export default function Countdown({ target }: { target: string }) {
  // null until the browser has mounted, so server and browser render the same thing first.
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    const end = new Date(target).getTime();
    const tick = () => setLeft(end - Date.now());
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [target]);

  if (left === null) return <div className="nd-count" aria-hidden="true">&nbsp;</div>;
  if (left <= 0) {
    return <p className="nd-live">The live draw is starting now. Watch it on our Facebook page.</p>;
  }

  const { days, hours, minutes, seconds } = splitRemaining(left);
  const units: [string, number][] = [["days", days], ["hours", hours], ["minutes", minutes], ["seconds", seconds]];
  return (
    <div className="nd-count" role="timer" aria-label={`${days} days ${hours} hours ${minutes} minutes left`}>
      {units.map(([label, n]) => (
        <div className="nd-unit" key={label}>
          <span className="nd-num">{two(n)}</span>
          <span className="nd-label">{label}</span>
        </div>
      ))}
    </div>
  );
}
