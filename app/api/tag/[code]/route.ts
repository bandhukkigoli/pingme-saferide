// GET /api/tag/PM-BAG-2207 -> is this bag tag registered, and to which child?
import { handle } from "@/lib/api";
import { tagInfo } from "@/lib/actions";
export const dynamic = "force-dynamic";
export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  return handle(() => tagInfo(decodeURIComponent(code)));
}
