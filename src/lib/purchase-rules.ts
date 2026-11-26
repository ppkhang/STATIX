// Pure rules for who may take a hold, no database. Tested in purchase-rules.test.ts.
import type { DropState } from "./drop-status";

export type Refusal = "notOpen" | "closed" | "soldOut" | "needEmail" | "needPhone" | "needInvite";

export type Buyer = {
  emailVerified: boolean;
  phoneVerified: boolean;
  tier: string;
  /** Has accepted an invite for this drop (invite.account_id is this account). */
  invited: boolean;
};

/**
 * Why this buyer can't take a unit right now, or null if they can. Early access goes by an accepted invite for the
 * drop, never by tier or early_access_minutes: verifying an email already makes anyone a Member, so a tier gate
 * would let everyone in. Founders are the one exception (BRU-004).
 */
export function refusal(state: DropState, buyer: Buyer): Refusal | null {
  if (state === "closed") return "closed";
  if (state === "scheduled") return "notOpen";
  if (state === "sold_out") return "soldOut";
  if (!buyer.emailVerified) return "needEmail";
  if (!buyer.phoneVerified) return "needPhone"; // page 8: needed before the first drop purchase
  if (state === "early_access" && !buyer.invited && buyer.tier !== "founder") return "needInvite";
  return null;
}
