// Pure checkout rules, no database. Tested in checkout-rules.test.ts.
import { toE164VN } from "./auth-rules";

/** Strips accents and case, so "Hồ Chí Minh" and "ho chi minh" are the same place. */
const plain = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase();

/**
 * The fallback shipping table, used while there is no GHN account (FR-046).
 * [ASSUMPTION] these rates are placeholders, not quotes. shortcut: replace with GHN's quote and keep this for
 * when GHN is down.
 */
export function shippingEstimateVnd(province: string): number {
  const place = plain(province);
  if (/ho chi minh|\bhcm\b|sai ?gon/.test(place)) return 30_000;
  if (/ha ?noi/.test(place)) return 40_000;
  return 50_000;
}

export type Address = { recipient: string; receiverPhone: string; province: string; ward: string; street: string };
export type AddressProblem = "missing" | "tooLong" | "badPhone";

export function cleanAddress(raw: Record<keyof Address, string>): { value: Address } | { problem: AddressProblem } {
  const value = Object.fromEntries(Object.entries(raw).map(([key, text]) => [key, text.trim().replace(/\s+/g, " ")])) as Address;
  if (Object.values(value).some((text) => !text)) return { problem: "missing" };
  if (Object.values(value).some((text) => text.length > 120)) return { problem: "tooLong" };
  const phone = toE164VN(value.receiverPhone);
  return phone ? { value: { ...value, receiverPhone: phone } } : { problem: "badPhone" };
}
