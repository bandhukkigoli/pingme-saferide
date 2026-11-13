// POST /api/admin/start {scenario, kind, speed, targetChildId} -> starts a fresh trip on every bus.
import { handle, body } from "@/lib/api";
import { startDemo } from "@/lib/actions";
export async function POST(req: Request) {
  const b = await body(req);
  return handle(async () => {
    await startDemo(b.scenario, b.kind, Number(b.speed), b.targetChildId ? Number(b.targetChildId) : 1);
    return { ok: true };
  });
}
