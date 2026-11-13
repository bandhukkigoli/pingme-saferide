// GET /api/state  -> the whole live world (add ?child=ID for the parent view). Polled every 1.5 s.
import { handle } from "@/lib/api";
import { buildWorld } from "@/lib/world";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const child = Number(new URL(req.url).searchParams.get("child")) || null;
  return handle(() => buildWorld(child));
}
