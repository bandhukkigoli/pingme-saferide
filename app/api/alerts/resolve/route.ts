// POST /api/alerts/resolve {alertId, resolution} -> the desk closes an alert.
import { handle, body } from "@/lib/api";
import { resolveAlert } from "@/lib/actions";
export async function POST(req: Request) {
  const b = await body(req);
  return handle(async () => {
    await resolveAlert(Number(b.alertId), String(b.resolution || ""));
    return { ok: true };
  });
}
