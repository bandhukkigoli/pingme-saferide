// POST /api/admin/reset {full?} -> clear the live demo (or rebuild the whole database).
import { handle, body } from "@/lib/api";
import { resetDemo } from "@/lib/actions";
export async function POST(req: Request) {
  const b = await body(req);
  return handle(async () => {
    await resetDemo(!!b.full);
    return { ok: true };
  });
}
