// POST /api/trip/found {busId, childId} -> "Found · scan off".
import { handle, body } from "@/lib/api";
import { found } from "@/lib/actions";
export async function POST(req: Request) {
  const b = await body(req);
  return handle(async () => {
    await found(Number(b.busId), Number(b.childId));
    return { ok: true };
  });
}
