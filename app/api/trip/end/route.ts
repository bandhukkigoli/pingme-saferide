// POST /api/trip/end {busId} -> close the trip (blocked if a child is still on board).
import { handle, body } from "@/lib/api";
import { endTripNow } from "@/lib/actions";
export async function POST(req: Request) {
  const b = await body(req);
  return handle(async () => ({ ok: true, ...(await endTripNow(Number(b.busId))) }));
}
