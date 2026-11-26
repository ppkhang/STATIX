// Email and SMS. With no provider, development prints the message to the server log.
// shortcut: SMS has no provider at all; pick one before launch. Email needs RESEND_API_KEY and EMAIL_FROM.
// STUB_SENDERS=1 allows the log stub in a local production build. Never set it on a real host: the log holds live links.
const stubbed = () => process.env.NODE_ENV !== "production" || process.env.STUB_SENDERS === "1";
const resendReady = () => Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

export const canEmail = () => resendReady() || stubbed();
export const canText = () => stubbed();

/** Links in emails come from configuration, never from the request's Host header. */
export function appUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (!stubbed()) throw new Error("APP_URL is not set");
  return "http://localhost:3000";
}

export async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  if (resendReady()) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject, text }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`Resend answered ${response.status}`);
    return;
  }
  if (!stubbed()) throw new Error("No email provider: set RESEND_API_KEY and EMAIL_FROM");
  console.log(`[email stub] to=${to} subject=${subject}\n${text}`);
}

export async function sendSms(to: string, text: string): Promise<void> {
  if (!stubbed()) throw new Error("No SMS provider");
  console.log(`[sms stub] to=${to} ${text}`);
}
