"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Asks the server for the page again every few seconds. The page says when it was drawn, so a stall shows. */
export default function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => { if (!document.hidden) router.refresh(); }, seconds * 1000);
    return () => clearInterval(timer);
  }, [router, seconds]);
  return null;
}
