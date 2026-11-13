// GET /api/state  -> the whole live world (add ?child=ID for the parent view). Polled every 1.5 s.
import { NextResponse } from "next/server";
import { buildWorld } from "@/lib/world";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const child = Number(new URL(req.url).searchParams.get("child")) || null;
  const t0 = Date.now();
  // Temporary diagnostic: log polls coming from the Android app's web view ("wv" in the user agent).
  const ua = req.headers.get("user-agent") || "";
  if (/; wv\)/.test(ua)) console.log(`app-poll child=${child} ua=${ua.slice(0, 80)}`);
  try {
    const world = await buildWorld(child);
    // Server-Timing tells the browser's dev tools how long the server itself took (for speed checks).
    return NextResponse.json(world, { headers: { "Cache-Control": "no-store", "Server-Timing": `app;dur=${Date.now() - t0}` } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Something went wrong on the server. Please try again." }, { status: 500 });
  }
}
