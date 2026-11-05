"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterForm({ centerSlug, centerName }: { centerSlug: string; centerName: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, centerSlug, gender }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        setBusy(false);
        return;
      }
      router.push(`/quiz/${data.attemptId}`);
    } catch {
      setError("Network problem. Please check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <label htmlFor="name">Full name</label>
      <input id="name" type="text" autoComplete="name" value={name}
        onChange={(e) => setName(e.target.value)} maxLength={80} required />

      <label htmlFor="phone">Phone number</label>
      <input id="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="01XXXXXXXXX"
        value={phone} onChange={(e) => setPhone(e.target.value)} required />

      <label htmlFor="gender">Gender (optional)</label>
      <select id="gender" value={gender} onChange={(e) => setGender(e.target.value)}
        style={{ width: "100%", padding: 12, fontSize: "1rem", border: "1px solid var(--line)", borderRadius: 10, background: "var(--bg)", color: "var(--ink)" }}>
        <option value="">Prefer not to say</option>
        <option value="male">Male</option>
        <option value="female">Female</option>
      </select>

      <label>Coaching center</label>
      <div className="readonly">{centerName}</div>

      {error && <div className="error" role="alert">{error}</div>}
      <button className="btn" type="submit" disabled={busy}>
        {busy ? "Starting…" : "Start Quiz"}
      </button>
    </form>
  );
}
