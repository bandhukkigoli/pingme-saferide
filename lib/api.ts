// Tiny helper for API routes: runs the handler, turns errors into { error: "..." } JSON.
import { NextResponse } from "next/server";
import { UserError } from "./actions";

export async function handle(fn: () => Promise<unknown>) {
  try {
    const out = await fn();
    return NextResponse.json(out ?? { ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof UserError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Something went wrong on the server. Please try again." }, { status: 500 });
  }
}

// Read the JSON body of a request (empty object if there is none).
export async function body(req: Request): Promise<any> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}
