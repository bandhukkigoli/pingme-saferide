// POST /api/scan {busId, childId? | tagCode?, action?} -> attendant scans a bag tag on/off.
import { handle, body } from "@/lib/api";
import { scan } from "@/lib/actions";
export async function POST(req: Request) {
  const b = await body(req);
  return handle(async () => ({
    ok: true,
    ...(await scan(Number(b.busId), { childId: b.childId ? Number(b.childId) : undefined, tagCode: b.tagCode, action: b.action })),
  }));
}
