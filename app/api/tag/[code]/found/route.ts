// POST /api/tag/PM-BAG-2207/found {message} -> "Found this bag? Alert the parent" (number stays hidden).
import { handle, body } from "@/lib/api";
import { bagFound } from "@/lib/actions";
export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const b = await body(req);
  return handle(async () => {
    await bagFound(decodeURIComponent(code), b.message);
    return { ok: true };
  });
}
