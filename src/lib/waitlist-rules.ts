// Pure waitlist rules, no database. Tested in waitlist-rules.test.ts.

export const LINK_DAYS = 7; // [ASSUMPTION] PRC-02: an unconfirmed signup lapses after 7 days

/** What a new signup does to the entry already on file for this address and drop, if any (FR-022). */
export function onJoin(status: string | undefined): "create" | "restart" | "relink" | "already" {
  if (status === undefined) return "create";
  if (status === "left") return "restart"; // a fresh consent
  return status === "pending" ? "relink" : "already"; // confirmed and invited stay as they are
}

const UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

/** FR-023: only the campaign tags, as short strings. Anything else the browser sends is dropped. */
export function cleanSource(raw: unknown): Record<string, string> | null {
  if (!raw || typeof raw !== "object") return null;
  const kept: Record<string, string> = {};
  for (const key of UTM) {
    const value = (raw as Record<string, unknown>)[key];
    if (typeof value === "string" && value.trim()) kept[key] = value.trim().slice(0, 100);
  }
  return Object.keys(kept).length ? kept : null;
}

/** Product interests: known slugs only, each once. */
export const cleanInterests = (picked: string[], known: string[]) => known.filter((slug) => picked.includes(slug));
