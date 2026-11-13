// POST /api/join -> a judge gets a demo child nobody else has.
import { handle } from "@/lib/api";
import { joinAsParent } from "@/lib/actions";
export async function POST() {
  return handle(async () => ({ ok: true, childId: await joinAsParent() }));
}
