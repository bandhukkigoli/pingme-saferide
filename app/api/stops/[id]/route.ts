// PATCH /api/stops/3 {name} -> rename.  DELETE /api/stops/3 -> delete.
import { handle, body } from "@/lib/api";
import { deleteStop, renameStop } from "@/lib/actions";
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const b = await body(req);
  return handle(async () => {
    await renameStop(Number(id), b.name);
    return { ok: true };
  });
}
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle(async () => {
    await deleteStop(Number(id));
    return { ok: true };
  });
}
