// GET /api/nearest?lat=..&lng=.. -> 3 nearest stops. The pin is used only for this maths, never stored.
import { handle } from "@/lib/api";
import { nearestStops } from "@/lib/actions";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  return handle(async () => ({ stops: await nearestStops(Number(p.get("lat")), Number(p.get("lng"))) }));
}
