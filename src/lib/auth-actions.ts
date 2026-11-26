"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { AuthError, CredentialsSignin } from "next-auth";
import { getTranslations } from "next-intl/server";
import { currentAccount, googleEnabled, signIn, signOut } from "@/auth";
import * as accounts from "./accounts";
import { normalizeEmail, passwordOk, safeNext, toE164VN } from "./auth-rules";
import { hashPassword, verifyPassword } from "./password";
import { allow, clientIp } from "./rate-limit";
import { appUrl, canEmail, canText, sendEmail, sendSms } from "./senders";

/** `error` and `sent` are message keys under "auth". */
export type FormState = { error?: string; sent?: string; email?: string };

const HOUR = 60 * 60;
const field = (form: FormData, name: string) => String(form.get(name) ?? "");

async function within(action: string, subject: string, max: number, ipMax: number) {
  const ip = clientIp(await headers());
  return (await allow(`${action}:ip:${ip}`, ipMax, HOUR)) && (await allow(`${action}:${subject}`, max, HOUR));
}

/** Sent after the response, so how long it takes says nothing about whether the account exists. */
async function mailLater(to: string, kind: "verify" | "reset" | "exists", accountId: string) {
  const t = await getTranslations("mail");
  const base = appUrl();
  after(async () => {
    const url = kind === "exists" ? `${base}/login` : `${base}/${kind}?token=${await accounts.issueToken(accountId, kind)}`;
    await sendEmail(to, t(`${kind}.subject`), t(`${kind}.body`, { url }));
  });
}

export async function login(_state: FormState, form: FormData): Promise<FormState> {
  const email = field(form, "email");
  try {
    await signIn("credentials", {
      email, password: field(form, "password"),
      redirectTo: safeNext(form.get("next"), "/account"),
    });
  } catch (error) {
    if (error instanceof CredentialsSignin) return { email, error: error.code === "rate_limited" ? "rateLimited" : "badLogin" };
    if (error instanceof AuthError) return { email, error: "generic" };
    throw error; // success is a redirect, which Next throws
  }
  return {};
}

export async function loginWithGoogle(form: FormData) {
  if (!googleEnabled) return;
  await signIn("google", { redirectTo: safeNext(form.get("next"), "/account") });
}

export async function logout() {
  await signOut({ redirectTo: "/" });
}

export async function register(_state: FormState, form: FormData): Promise<FormState> {
  const raw = field(form, "email");
  const email = normalizeEmail(raw);
  const password = field(form, "password");
  if (!email) return { email: raw, error: "badEmail" };
  if (!passwordOk(password)) return { email: raw, error: "badPassword" };
  if (!canEmail()) return { email: raw, error: "noEmail" };
  if (!(await within("register", email, 3, 10))) return { email: raw, error: "rateLimited" };

  // The answer is the same whether or not the address is taken. The password is hashed either way.
  const passwordHash = await hashPassword(password);
  const created = await accounts.createAccount(email, passwordHash);
  const row = created ?? (await accounts.findByEmail(email));
  if (row) await mailLater(email, row.emailVerified ? "exists" : "verify", row.id);
  return { sent: "checkInbox" };
}

/** "Resend" on /verify and "Forgot password" on /reset: one answer for every address. */
async function requestLink(kind: "verify" | "reset", form: FormData): Promise<FormState> {
  const raw = field(form, "email");
  const email = normalizeEmail(raw);
  if (!email) return { email: raw, error: "badEmail" };
  if (!canEmail()) return { email: raw, error: "noEmail" };
  if (!(await within(kind, email, 3, 10))) return { email: raw, error: "rateLimited" };
  const row = await accounts.findByEmail(email);
  if (row && !(kind === "verify" && row.emailVerified)) await mailLater(email, kind, row.id);
  return { sent: kind === "reset" ? "resetSent" : "checkInbox" };
}

export async function resendVerify(_state: FormState, form: FormData) {
  return requestLink("verify", form);
}

export async function forgotPassword(_state: FormState, form: FormData) {
  return requestLink("reset", form);
}

/**
 * Verifying needs the link and either a session on that account or its password. Otherwise someone could
 * register your address with their password and get in once you click the link.
 */
export async function verifyEmail(_state: FormState, form: FormData): Promise<FormState> {
  const token = field(form, "token");
  const row = await accounts.peekToken(token, "verify");
  if (!row) return { error: "badLink" };
  if ((await currentAccount())?.id !== row.id) {
    if (!(await within("verify-password", row.id, 10, 20))) return { error: "rateLimited" };
    if (!(await verifyPassword(field(form, "password"), row.passwordHash))) return { error: "badPasswordForLink" };
  }
  if (!(await accounts.useToken(token, "verify"))) return { error: "badLink" };
  await accounts.markVerified(row);
  redirect("/verify?done=1");
}

export async function resetPassword(_state: FormState, form: FormData): Promise<FormState> {
  const password = field(form, "password");
  if (!passwordOk(password)) return { error: "badPassword" }; // checked first, so a typo keeps the link
  if (!(await allow(`reset-submit:ip:${clientIp(await headers())}`, 20, HOUR))) return { error: "rateLimited" };
  const accountId = await accounts.useToken(field(form, "token"), "reset");
  if (!accountId) return { error: "badLink" };
  await accounts.setPassword(accountId, await hashPassword(password));
  redirect("/login?reset=1");
}

export async function sendPhoneCode(_state: FormState, form: FormData): Promise<FormState> {
  const me = await currentAccount();
  if (!me?.emailVerified) return { error: "generic" };
  const phone = toE164VN(field(form, "phone"));
  if (!phone) return { error: "badPhone" };
  if (!canText()) return { error: "noSms" };
  if (!(await within("otp", me.id, 3, 10)) || !(await allow(`otp:phone:${phone}`, 3, HOUR))) return { error: "rateLimited" };
  const t = await getTranslations("mail");
  await sendSms(phone, t("otp", { code: await accounts.issueOtp(me.id, phone) }));
  redirect("/account");
}

export async function checkPhoneCode(_state: FormState, form: FormData): Promise<FormState> {
  const me = await currentAccount();
  if (!me?.emailVerified) return { error: "generic" };
  if (!(await within("otp-check", me.id, 15, 30))) return { error: "rateLimited" };
  const result = await accounts.checkOtp(me.id, field(form, "code").trim());
  if (result !== "ok") return { error: { wrong: "wrongCode", expired: "expiredCode", taken: "phoneTaken" }[result] };
  redirect("/account");
}
