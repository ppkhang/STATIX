"use client";

/**
 * art-flight.js, as a blocking script: it must run before the first paint, or an arriving page flashes.
 * React warns when it draws a script in the browser (as it does after a server error), so there the tag is inert.
 * From node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md
 */
export default function ArtFlightScript() {
  // eslint-disable-next-line @next/next/no-sync-scripts -- blocking on purpose, see above
  return <script src="/art-flight.js" type={typeof window === "undefined" ? "text/javascript" : "text/plain"} suppressHydrationWarning />;
}
