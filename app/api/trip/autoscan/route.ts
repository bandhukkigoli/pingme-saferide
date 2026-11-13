// POST /api/trip/autoscan {busId, on} -> the "Auto-scan (demo)" toggle.
import { handle, body } from "@/lib/api";
import { setAutoScan } from "@/lib/actions";
export async function POST(req: Request) {
  const b = await body(req);
  return handle(async () => {
    await setAutoScan(Number(b.busId), !!b.on);
    return { ok: true };
  });
}
