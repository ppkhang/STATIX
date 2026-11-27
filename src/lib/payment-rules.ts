// Pure payment rules, no database. Tested in payment-rules.test.ts.

type Env = Record<string, string | undefined>;

/**
 * The mock payment provider approves orders with no money, so it takes two things to be on: PAYMENT_MOCK=1, and in a
 * production build an APP_URL that is this machine. A real host has to set APP_URL to its own address (emails use
 * it), so the flag alone can't open free checkout there.
 */
export function mockPaymentsOn(env: Env = process.env): boolean {
  if (env.PAYMENT_MOCK !== "1") return false;
  if (env.NODE_ENV !== "production") return true;
  try {
    return ["localhost", "127.0.0.1"].includes(new URL(env.APP_URL ?? "").hostname);
  } catch {
    return false;
  }
}

/** The online methods there are adapters (or mocks) for. COD waits on the decision about it. */
export const ONLINE_METHODS = ["vnpay", "momo"] as const;
export type OnlineMethod = (typeof ONLINE_METHODS)[number];
export const isOnlineMethod = (value: string): value is OnlineMethod => (ONLINE_METHODS as readonly string[]).includes(value);
