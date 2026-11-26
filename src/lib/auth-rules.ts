// Pure account rules, no database. Tested in auth-rules.test.ts.

/** Trimmed and lowercased, or null if it is not shaped like an email. */
export function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

/** Vietnamese mobile number as E.164 (+84…), or null. */
export function toE164VN(raw: string): string | null {
  const digits = raw.replace(/[\s.()-]/g, "");
  const match = /^(?:\+84|84|0)([35789]\d{8})$/.exec(digits);
  return match ? `+84${match[1]}` : null;
}

// OWASP ASVS 4.0.3 §2.1: at least 12 characters, long ones allowed, no composition rules.
// shortcut: no breached-password check (2.1.7); add one before the NFR-011 launch review.
export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;
export const passwordOk = (password: string) => {
  const length = [...password].length;
  return length >= PASSWORD_MIN && length <= PASSWORD_MAX;
};

/** Only a path on this site may follow a sign-in. */
export function safeNext(next: unknown, fallback: string): string {
  return typeof next === "string" && /^\/(?!\/)[^\\\x00-\x20]*$/.test(next) ? next : fallback;
}

/** Page 8: verifying moves a Visitor to Waitlist (already on the list) or Member. Higher tiers stay. */
export function tierOnVerify(current: string, onWaitlist: boolean): string {
  if (current !== "visitor") return current;
  return onWaitlist ? "waitlist" : "member";
}
