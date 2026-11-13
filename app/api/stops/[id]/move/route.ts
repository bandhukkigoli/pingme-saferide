// POST /api/stops/3/move {dir: "up" | "down"} -> reorder a stop.
import { handle, body } from "@/lib/api";
import { moveStop } from "@/lib/actions";
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const b = await body(req);
  return handle(async () => {
    await moveStop(Number(id), b.dir === "down" ? "down" : "up");
    return { ok: true };
  });
}
