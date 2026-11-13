// GET /api/routes -> buses, their stops and the real road geometry (for the maps).
import { handle } from "@/lib/api";
import { getRoutes } from "@/lib/world";
export const dynamic = "force-dynamic";
export async function GET() {
  return handle(() => getRoutes());
}
