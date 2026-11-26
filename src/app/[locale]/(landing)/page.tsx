import { readFileSync } from "node:fs";
import path from "node:path";
import Script from "next/script";
import { setRequestLocale } from "next-intl/server";

// shortcut: the landing is the original index.html markup and script, unchanged. Port it to
// React components when it needs live data (stock bar, countdown, signup in M1/M3).
const markup = readFileSync(path.join(process.cwd(), "src/app/[locale]/(landing)/landing.html"), "utf8");

export default async function Landing({ params }: PageProps<"/[locale]">) {
  setRequestLocale((await params).locale);
  return (
    <>
      {/* The landing copy is English only for now. */}
      <div lang="en" style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: markup }} />
      <Script src="/landing.js" strategy="afterInteractive" />
    </>
  );
}
