// Auth.js v5. JWT sessions and our own account table, so no database adapter.
import { cache } from "react";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { accountForGoogle, findByEmail, findById, type Account } from "@/lib/accounts";
import { normalizeEmail, PASSWORD_MAX } from "@/lib/auth-rules";
import { verifyPassword } from "@/lib/password";
import { allow, clientIp } from "@/lib/rate-limit";

class RateLimited extends CredentialsSignin {
  code = "rate_limited";
}

export const googleEnabled = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

const passwordStamp = (row: Account) => row.passwordChangedAt?.getTime() ?? 0;

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 14 * 24 * 60 * 60 },
  pages: { signIn: "/login", error: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      // the limits live here so that posting straight to /api/auth can't skip them
      async authorize(input, request) {
        const email = normalizeEmail(String(input.email ?? ""));
        const password = String(input.password ?? "");
        if (!email || !password || password.length > PASSWORD_MAX * 2) return null;
        const ipOk = await allow(`login:ip:${clientIp(request.headers)}`, 20, 15 * 60);
        if (!ipOk || !(await allow(`login:email:${email}`, 10, 15 * 60))) throw new RateLimited();
        const row = await findByEmail(email);
        if (!(await verifyPassword(password, row?.passwordHash))) return null;
        return { id: row!.id, email };
      },
    }),
    ...(googleEnabled ? [Google] : []),
  ],
  callbacks: {
    signIn: ({ account, profile }) => account?.provider !== "google" || profile?.email_verified === true,
    async jwt({ token, user, account }) {
      if (user) { // only at sign-in
        const email = normalizeEmail(user.email ?? "");
        const row = account?.provider === "google"
          ? (email ? await accountForGoogle(email) : undefined)
          : await findById(user.id!);
        if (!row) return null;
        token.uid = row.id;
        token.passwordStamp = passwordStamp(row);
      }
      return token;
    },
    session: ({ session, token }) => ({ ...session, uid: token.uid, passwordStamp: token.passwordStamp }),
  },
});

/** The signed-in account, read fresh from the database. Null once the password has changed. */
export const currentAccount = cache(async (): Promise<Account | null> => {
  const session = (await auth()) as { uid?: string; passwordStamp?: number } | null;
  if (!session?.uid) return null;
  const row = await findById(session.uid);
  return row && passwordStamp(row) === session.passwordStamp ? row : null;
});
