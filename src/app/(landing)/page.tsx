import { readFileSync } from "node:fs";
import path from "node:path";
import Script from "next/script";

// shortcut: the landing is the original index.html markup and script. Port it to
// React components when its signup goes live (M3).
const markup = readFileSync(path.join(process.cwd(), "src/app/(landing)/landing.html"), "utf8");

export default function Landing() {
  return (
    <>
      <div style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: markup }} />
      <Script src="/landing.js" strategy="afterInteractive" />
    </>
  );
}
