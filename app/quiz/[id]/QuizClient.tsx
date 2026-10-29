"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Q = { id: string; text: string; options: string[] };

export default function QuizClient(props: {
  attemptId: string;
  questions: Q[];
  initialAnswers: Record<string, number>;
  expiresAt: string;
  serverNow: string;
}) {
  const { attemptId, questions, expiresAt, serverNow } = props;
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, number>>(props.initialAnswers);
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.ceil((new Date(expiresAt).getTime() - new Date(serverNow).getTime()) / 1000))
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef<Promise<unknown>[]>([]);
  const submittedRef = useRef(false);

  // The countdown is based on the server's clock offset, so a wrong phone clock cannot extend time.
  const offsetRef = useRef(new Date(serverNow).getTime() - Date.now());
  useEffect(() => {
    const tick = () => {
      const now = Date.now() + offsetRef.current;
      setSecondsLeft(Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 1000)));
    };
    tick();
    const t = setInterval(tick, 500);
    return () => clearInterval(t);
  }, [expiresAt]);

  const submit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    try {
      await Promise.allSettled(pending.current); // let in-flight answer saves finish first
      const res = await fetch(`/api/attempts/${attemptId}/submit`, { method: "POST" });
      if (!res.ok) throw new Error("submit failed");
      router.replace(`/result/${attemptId}`);
    } catch {
      submittedRef.current = false;
      setSubmitting(false);
      setError("Could not submit. Check your connection and tap Submit again.");
    }
  }, [attemptId, router]);

  useEffect(() => {
    if (secondsLeft === 0) void submit();
  }, [secondsLeft, submit]);

  function choose(qid: string, idx: number) {
    if (submitting || secondsLeft === 0) return;
    setAnswers((a) => ({ ...a, [qid]: idx }));
    const p = fetch(`/api/attempts/${attemptId}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId: qid, choice: idx }),
    }).catch(() => setError("An answer may not have saved. Please select it again."));
    pending.current.push(p);
  }

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const answered = questions.filter((q) => answers[q.id] !== undefined).length;

  return (
    <>
      <div className="timerbar" role="timer" aria-live="off">
        <span>{answered}/{questions.length} answered</span>
        <span className={`timer ${secondsLeft <= 30 ? "low" : ""}`}>{mm}:{ss}</span>
      </div>
      <main>
        {questions.map((q, i) => (
          <div className="card q" key={q.id}>
            <h3>{i + 1}. {q.text}</h3>
            {q.options.map((opt, idx) => (
              <label key={idx} className={`opt ${answers[q.id] === idx ? "sel" : ""}`} style={{ fontWeight: 400, margin: "0 0 8px" }}>
                <input type="radio" name={q.id} checked={answers[q.id] === idx}
                  onChange={() => choose(q.id, idx)} disabled={submitting} />
                <span>{opt}</span>
              </label>
            ))}
          </div>
        ))}
        {error && <div className="error" role="alert">{error}</div>}
        <button className="btn" onClick={() => void submit()} disabled={submitting}>
          {submitting ? "Submitting…" : "Submit answers"}
        </button>
      </main>
    </>
  );
}
