// POST /api/admin/pause -> pause or resume all trips.
import { handle } from "@/lib/api";
import { togglePause } from "@/lib/actions";
export async function POST() {
  return handle(async () => ({ ok: true, paused: await togglePause() }));
}
