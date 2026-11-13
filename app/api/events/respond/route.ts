// POST /api/events/respond {eventId, response} -> parent answers an alert ("I'm going", missed-bus answer...).
import { handle, body } from "@/lib/api";
import { respondToEvent } from "@/lib/actions";
export async function POST(req: Request) {
  const b = await body(req);
  return handle(async () => {
    await respondToEvent(Number(b.eventId), String(b.response || "Acknowledged"));
    return { ok: true };
  });
}
