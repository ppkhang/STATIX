// The landing's plain script signs people up through here (the React panel uses a server action instead).
import { clientIp } from "@/lib/rate-limit";
import { signUp, type SignupInput } from "@/lib/waitlist-signup";

const STATUS = { invalid: 400, needConsent: 400, rateLimited: 429, unavailable: 503 } as const;
const answer = (body: object, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  // Route handlers get no origin check of their own. Only this site's pages may post here: another site could
  // otherwise sign strangers up from their own browsers.
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !URL.canParse(origin) || new URL(origin).host !== host) return answer({ error: "forbidden" }, 403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return answer({ error: "invalid" }, 415);

  const text = await request.text();
  if (text.length > 4000) return answer({ error: "invalid" }, 413);
  let input: SignupInput;
  try {
    input = JSON.parse(text) ?? {};
  } catch {
    return answer({ error: "invalid" }, 400);
  }
  const result = await signUp(input, clientIp(request.headers));
  return result.ok ? answer({ ok: true }) : answer({ error: result.error }, STATUS[result.error]);
}
