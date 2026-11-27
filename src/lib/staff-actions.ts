"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { PASSWORD_MAX } from "./auth-rules";
import { allow, clientIp } from "./rate-limit";
import { signInStaff, signOutStaff } from "./staff";
import { STAFF_COOKIE, staffCookie } from "./staff-session";

export type StaffLoginState = { error?: "badLogin" | "rateLimited"; email?: string };

export async function staffLogin(_state: StaffLoginState, form: FormData): Promise<StaffLoginState> {
  const field = (name: string) => String(form.get(name) ?? "");
  const email = field("email").trim().toLowerCase().slice(0, 254);
  const password = field("password");
  // the limits are what stop someone working through the million possible codes
  if (!(await allow(`staff:ip:${clientIp(await headers())}`, 20, 900)) || !(await allow(`staff:${email}`, 10, 900))) {
    return { email, error: "rateLimited" };
  }
  const token = password.length <= PASSWORD_MAX * 2 ? await signInStaff(email, password, field("code").trim()) : null;
  if (!token) return { email, error: "badLogin" };
  (await cookies()).set(STAFF_COOKIE, token, staffCookie);
  redirect("/admin");
}

export async function staffLogout() {
  const jar = await cookies();
  const token = jar.get(STAFF_COOKIE)?.value;
  if (token) await signOutStaff(token);
  // deleted with the same path it was set with, or the browser keeps it
  jar.set(STAFF_COOKIE, "", { ...staffCookie, maxAge: 0 });
  redirect("/admin/login");
}
