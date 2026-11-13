// POST /api/prefs {childId, radiusM} -> the parent's alert radius.
import { handle, body } from "@/lib/api";
import { setRadius } from "@/lib/actions";
export async function POST(req: Request) {
  const b = await body(req);
  return handle(async () => {
    await setRadius(Number(b.childId), Number(b.radiusM));
    return { ok: true };
  });
}
