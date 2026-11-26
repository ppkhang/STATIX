import { sql } from "drizzle-orm";
import { db } from "@/db";
import { rateLimit } from "@/db/schema";

/** Counts this attempt and says whether it is still within `max` per window. One statement, so it can't race. */
export async function allow(key: string, max: number, windowSeconds: number): Promise<boolean> {
  const expired = sql`${rateLimit.windowStart} <= now() - make_interval(secs => ${windowSeconds})`;
  const [row] = await db.insert(rateLimit)
    .values({ key, windowStart: sql`now()`, count: 1 })
    .onConflictDoUpdate({
      target: rateLimit.key,
      set: {
        count: sql`case when ${expired} then 1 else ${rateLimit.count} + 1 end`,
        windowStart: sql`case when ${expired} then now() else ${rateLimit.windowStart} end`,
      },
    })
    .returning({ count: rateLimit.count });
  return row.count <= max;
}

// shortcut: trusts x-forwarded-for, which is only safe behind a proxy that overwrites it (Vercel does).
export const clientIp = (headers: Headers) => headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
