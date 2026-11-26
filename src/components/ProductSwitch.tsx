"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

declare global {
  interface Window {
    /** Set while a product page is up, so art-flight.js can change product without reloading the page. */
    statixSwitch?: (href: string) => void;
  }
}

export default function ProductSwitch() {
  const router = useRouter();
  useEffect(() => {
    // scroll: false, because art-flight.js glides the page up itself once the new product is in place
    const go = (href: string) => router.push(href, { scroll: false });
    window.statixSwitch = go;
    return () => { if (window.statixSwitch === go) delete window.statixSwitch; };
  }, [router]);
  return null;
}
