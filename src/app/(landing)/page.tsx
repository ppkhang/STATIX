import { readFileSync } from "node:fs";
import path from "node:path";
import Script from "next/script";

// shortcut: the landing is the original index.html markup and script. Port it to
// React components when its signup goes live (M3).
const file = path.join(process.cwd(), "src/app/(landing)/landing.html");

export default function Landing() {
  // read here, not at module load, so `next dev` shows HTML edits on refresh (a build still reads it once)
  const markup = readFileSync(file, "utf8");
  return (
    <>
      <div style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: markup }} />
      <Script src="/landing.js" strategy="afterInteractive" />
    </>
  );
}
