// POST /api/requests/5 {decision: "approve" | "reject"} -> the desk decides.
import { handle, body } from "@/lib/api";
import { decideRequest } from "@/lib/actions";
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const b = await body(req);
  return handle(async () => {
    await decideRequest(Number(id), b.decision === "approve" ? "approve" : "reject");
    return { ok: true };
  });
}
