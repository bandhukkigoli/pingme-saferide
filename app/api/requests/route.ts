// GET /api/requests -> list; POST /api/requests -> new rider or stop change request.
import { handle, body } from "@/lib/api";
import { createRequest, listRequests } from "@/lib/actions";
export const dynamic = "force-dynamic";
export async function GET() {
  return handle(async () => ({ requests: await listRequests() }));
}
export async function POST(req: Request) {
  const b = await body(req);
  return handle(async () => {
    await createRequest(b);
    return { ok: true };
  });
}
