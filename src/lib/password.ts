// Argon2id (NFR-012) from node:crypto, which needs Node 24.7 or newer.
import { argon2, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const derive = promisify(argon2);
const COST = { memory: 19456, passes: 2, parallelism: 1 }; // OWASP minimum for argon2id

const run = (password: string, nonce: Buffer, cost: typeof COST) =>
  derive("argon2id", { message: password.normalize("NFKC"), nonce, tagLength: 32, ...cost });

/** argon2id$memory$passes$parallelism$salt$hash, so the cost can be raised later. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await run(password, salt, COST);
  return ["argon2id", COST.memory, COST.passes, COST.parallelism, salt.toString("base64"), hash.toString("base64")].join("$");
}

const decoy = hashPassword(randomBytes(32).toString("hex"));

/** With no stored hash it still does the same work, so timing doesn't show whether an account exists. */
export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  const [, memory, passes, parallelism, salt, hash] = (stored ?? (await decoy)).split("$");
  const expected = Buffer.from(hash, "base64");
  const actual = await run(password, Buffer.from(salt, "base64"),
    { memory: Number(memory), passes: Number(passes), parallelism: Number(parallelism) });
  return timingSafeEqual(actual, expected) && Boolean(stored);
}
