"use client";

import { useEffect } from "react";

// Records one scan per browser tab session. Renders nothing.
export default function ScanPing({ slug }: { slug: string }) {
  useEffect(() => {
    const key = `scan:${slug}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // storage blocked: the server still dedupes repeat visits
    }
    fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
      keepalive: true,
    }).catch(() => {});
  }, [slug]);
  return null;
}
