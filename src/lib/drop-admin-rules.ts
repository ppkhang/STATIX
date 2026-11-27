// Pure rules for editing drops, no database. Tested in drop-admin-rules.test.ts.
import { dropStatus } from "./drop-status";

export type DropDetails = { name: string; earlyAccessAt: Date | null; publicAt: Date | null; closeAt: Date | null };
export type EditionTerms = { size: number; priceVnd: number; perPersonCap: number };

export const LIMITS = { size: 10_000, priceVnd: 1_000_000_000, cap: 10, name: 60 };

/** Whether anyone could have bought from it. From then on its details and editions are fixed. */
export const salesStarted = (drop: DropDetails & { state: string }, now: Date) => {
  const status = dropStatus(drop, now, 1);
  return status !== null && status.state !== "scheduled";
};

const whole = (value: number, max: number) => Number.isInteger(value) && value >= 1 && value <= max;

export function editionProblem({ size, priceVnd, perPersonCap }: EditionTerms) {
  if (!whole(size, LIMITS.size)) return "badSize" as const;
  if (!whole(priceVnd, LIMITS.priceVnd)) return "badPrice" as const;
  return whole(perPersonCap, LIMITS.cap) ? null : "badCap" as const;
}

/** What even a draft has to get right. Times may still be missing. */
export function detailsProblem({ name, earlyAccessAt, publicAt, closeAt }: DropDetails) {
  if (!name || name.length > LIMITS.name) return "badName" as const;
  if ([earlyAccessAt, publicAt, closeAt].some((at) => at && Number.isNaN(at.getTime()))) return "badTime" as const;
  if (earlyAccessAt && publicAt && earlyAccessAt >= publicAt) return "earlyAfterPublic" as const;
  if (publicAt && closeAt && closeAt <= publicAt) return "closeBeforePublic" as const;
  return null;
}

/** What a drop needs before it can be shown: a public opening, and no opening that has already gone by. */
export function scheduleProblem(drop: DropDetails, now: Date) {
  const wrong = detailsProblem(drop);
  if (wrong) return wrong;
  if (!drop.publicAt) return "noPublicTime" as const;
  return (drop.earlyAccessAt ?? drop.publicAt) <= now ? "inThePast" as const : null;
}

/** A datetime-local value, read as Vietnam time (NFR-024). Empty is null; nonsense is an invalid date. */
export const fromVietnamInput = (value: string): Date | null =>
  !value ? null : new Date(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? `${value}:00+07:00` : Number.NaN);

export const toVietnamInput = (date: Date | null) => (date ? new Date(date.getTime() + 7 * 3_600_000).toISOString().slice(0, 16) : "");
