import { getDrop, parseDropNumber } from "@/lib/catalogue";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: RouteContext<"/api/drops/[number]">) {
  const number = parseDropNumber((await params).number);
  const drop = number === null ? null : await getDrop(number);
  return Response.json(drop ?? { error: "not_found" }, {
    status: drop ? 200 : 404,
    headers: { "Cache-Control": "no-store" },
  });
}
