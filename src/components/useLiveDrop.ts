"use client";

import { useEffect, useState } from "react";
import type { DropSnapshot } from "@/lib/catalogue";

const POLL_MS = 3000; // NFR-004 allows 5 s

/** Keeps the server's drop snapshot fresh, plus a once-a-second clock corrected to server time. */
export function useLiveDrop(initial: DropSnapshot) {
  const [drop, setDrop] = useState(initial);
  const [now, setNow] = useState(() => Date.parse(initial.serverNow)); // same on server and client at first render
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let offset = Date.parse(initial.serverNow) - Date.now();
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const response = await fetch(`/api/drops/${initial.number}`, { cache: "no-store", signal: AbortSignal.timeout(5000) });
        if (!response.ok) throw new Error(String(response.status));
        const next: DropSnapshot = await response.json();
        if (stopped) return;
        offset = Date.parse(next.serverNow) - Date.now();
        setDrop(next);
        setStale(false);
      } catch {
        if (!stopped) setStale(true); // keep the last numbers and say so
      }
      if (!stopped) timer = setTimeout(poll, POLL_MS);
    };
    poll(); // the HTML may be old (back button), so refresh at once
    const clock = setInterval(() => setNow(Date.now() + offset), 1000);
    return () => { stopped = true; clearTimeout(timer); clearInterval(clock); };
  }, [initial]);

  return { drop, now, stale };
}
