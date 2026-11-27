// The drop state comes from the server clock (FR-016). The drop_run.state column is only trusted
// for draft and closed: nothing moves it through the other states yet.
export type DropState = "scheduled" | "early_access" | "public" | "sold_out" | "closed";

type Drop = { state: string; earlyAccessAt: Date | null; publicAt: Date | null; closeAt: Date | null };

/** Returns null for a draft, which the public must not see. */
export function dropStatus(drop: Drop, now: Date, left: number): { state: DropState; nextAt: Date | null } | null {
  if (drop.state === "draft") return null;
  const reached = (at: Date | null) => at !== null && now >= at;
  if (drop.state === "closed" || reached(drop.closeAt)) return { state: "closed", nextAt: null };

  const isPublic = reached(drop.publicAt);
  if (!isPublic && !reached(drop.earlyAccessAt)) return { state: "scheduled", nextAt: drop.earlyAccessAt ?? drop.publicAt };
  if (left === 0) return { state: "sold_out", nextAt: null };
  return isPublic ? { state: "public", nextAt: drop.closeAt } : { state: "early_access", nextAt: drop.publicAt };
}

/**
 * The drop the site is about: the lowest-numbered one that hasn't closed, so a later drop being scheduled doesn't
 * take over while an earlier one is selling. With none left open, the newest. Drafts don't count. Sold out is not
 * closed: a drop reads as sold out while every unit is merely held.
 */
export function currentDrop<T extends Drop & { number: number }>(drops: T[], now: Date): T | undefined {
  const shown = drops.filter((drop) => drop.state !== "draft").sort((a, b) => a.number - b.number);
  return shown.find((drop) => dropStatus(drop, now, 1)!.state !== "closed") ?? shown.at(-1);
}

/** One edition can sell out while the rest of the drop is still selling. */
export const editionState = (state: DropState, left: number): DropState =>
  left === 0 && (state === "early_access" || state === "public") ? "sold_out" : state;
