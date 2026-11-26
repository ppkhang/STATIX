// Pure early-access invite rules (FR-025), no database. Tested in invite-rules.test.ts.

const FALLBACK_HOURS = 72; // [ASSUMPTION] when a drop has no public opening to end the head start

/** When a new invite stops working: at the public opening, when the head start is over anyway. Null: too late to invite. */
export function inviteExpiry(publicAt: Date | null, now: Date): Date | null {
  if (!publicAt) return new Date(now.getTime() + FALLBACK_HOURS * 3_600_000);
  return publicAt > now ? publicAt : null;
}

export type InviteView =
  | "left" // they left the list after being invited
  | "yours" // already accepted by the account that's looking
  | "used" // accepted by someone else
  | "expired"
  | "signedOut"
  | "wrongAccount" // signed in with an address the invite wasn't sent to
  | "unverified" // the right address, not yet proven
  | "ready";

type Invite = { usedAt: Date | null; accountId: string | null; expiresAt: Date };
type Viewer = { id: string; email: string; emailVerified: boolean } | null;

/**
 * What the holder of a link may do. An invite is personal: only the account with the invited address, proven,
 * can accept it, so a forwarded link lets nobody else in early.
 */
export function inviteView(invite: Invite, entry: { emailNorm: string; status: string }, viewer: Viewer, now: Date): InviteView {
  if (invite.usedAt) return viewer && invite.accountId === viewer.id ? "yours" : "used";
  if (entry.status === "left") return "left";
  if (invite.expiresAt <= now) return "expired";
  if (!viewer) return "signedOut";
  if (viewer.email !== entry.emailNorm) return "wrongAccount";
  return viewer.emailVerified ? "ready" : "unverified";
}
