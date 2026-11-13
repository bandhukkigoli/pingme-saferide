// POST /api/stops {busId, name, lat, lng} -> route editor adds a stop (just before the school).
import { handle, body } from "@/lib/api";
import { addStop } from "@/lib/actions";
export async function POST(req: Request) {
  const b = await body(req);
  return handle(async () => {
    await addStop(Number(b.busId), b.name, Number(b.lat), Number(b.lng));
    return { ok: true };
  });
}
