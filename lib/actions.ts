// WRITE ACTIONS that are not part of the trip engine: demo control, requests/approvals,
// route editor, parent settings and responses, judges joining, bag-tag "found" alerts.

import { q, seedDatabase } from "./db";
import { addEvent, addAlert, log, loadPlans, simMinutes, tripOfBus, type TripRow } from "./sim";
import { fetchRoadRoute, haversine } from "./route";
import type { NearestStop, RequestRow, Scenario, TripKind } from "./types";

export class UserError extends Error {
  constructor(msg: string, public status = 400) {
    super(msg);
  }
}

// ---------- Demo control ----------

export async function startDemo(scenario: Scenario, kind: TripKind, speed: number, targetChildId: number | null) {
  if (!["normal", "missed", "wrong", "left"].includes(scenario)) throw new UserError("Unknown scenario");
  if (!["morning", "afternoon"].includes(kind)) throw new UserError("Unknown trip");
  if (![1, 2, 4].includes(speed)) throw new UserError("Speed must be 1, 2 or 4");
  await q("UPDATE trips SET active=FALSE WHERE active");
  const buses = await loadPlans();
  const now = Date.now();
  for (const [busId, b] of buses) {
    const [trip] = await q<{ id: number }>(
      "INSERT INTO trips (bus_id, kind, scenario, target_child_id, speed, started_at, status) VALUES ($1,$2,$3,$4,$5,$6,'running') RETURNING id",
      [busId, kind, scenario, targetChildId, speed, now]
    );
    // Everyone on this bus starts at home (morning) or at school (afternoon).
    await q(
      `INSERT INTO attendance (trip_id, child_id, state, value)
       SELECT $1, id, $2, $3 FROM children WHERE bus_id=$4 AND status='active'`,
      [trip.id, kind === "morning" ? "waiting" : "atschool", kind === "morning" ? "—" : "In class", busId]
    );
    await log("info", `Trip started: ${b.name}, ${kind === "morning" ? "home → school" : "school → home"}`, 0);
  }
}

// Pause every running trip, or resume every paused one.
export async function togglePause(): Promise<boolean> {
  const now = Date.now();
  const running = await q("SELECT id FROM trips WHERE active AND status='running'");
  if (running.length) {
    await q("UPDATE trips SET status='paused', paused_at=$1 WHERE active AND status='running'", [now]);
    return true;
  }
  await q("UPDATE trips SET status='running', paused_total_ms = paused_total_ms + ($1 - paused_at), paused_at=NULL WHERE active AND status='paused'", [now]);
  return false;
}

export async function resetDemo(full: boolean) {
  if (full) return seedDatabase();
  // Clears the live world but keeps judges' children, approvals and route edits.
  await q("DELETE FROM events");
  await q("DELETE FROM alerts");
  await q("DELETE FROM scans");
  await q("DELETE FROM attendance");
  await q("DELETE FROM trips");
  await q("DELETE FROM logs");
}

// ---------- Attendant actions (thin wrappers around the engine) ----------

export async function scan(busId: number, opts: { childId?: number; tagCode?: string; action?: "on" | "off" }) {
  const ctx = await tripOfBus(busId);
  if (!ctx) throw new UserError("No trip is running for this bus. Start one from Admin.", 409);
  const { trip, plan, t, pos } = ctx;
  if (trip.status === "closed") throw new UserError("This trip is closed.", 409);
  if (trip.status === "blocked") throw new UserError("Trip is blocked: use “Found · scan off” for children still on board.", 409);
  if (pos.atIdx === null) throw new UserError("The bus is driving. Scan bag tags when it stands at a stop.", 409);
  let childId = opts.childId;
  if (!childId && opts.tagCode) {
    const [tag] = await q<{ child_id: number | null; registered: boolean }>("SELECT child_id, registered FROM tags WHERE code=$1", [opts.tagCode.toUpperCase()]);
    if (!tag) throw new UserError("Unknown bag tag.", 404);
    if (!tag.registered || !tag.child_id) throw new UserError("This tag is not registered to a rider yet.", 409);
    childId = tag.child_id;
  }
  if (!childId) throw new UserError("Which child? Send childId or tagCode.");
  let action = opts.action;
  if (!action) {
    // Toggle: on if not on board, off if on board.
    const [a] = await q<{ state: string }>("SELECT state FROM attendance WHERE trip_id=$1 AND child_id=$2", [trip.id, childId]);
    if (!a) throw new UserError("This child is not on this bus's list today.", 409);
    action = a.state === "onboard" ? "off" : "on";
  }
  const res = await (await import("./sim")).doScan(trip, plan, childId, action, pos.atIdx, t, true);
  if (!res.ok) throw new UserError(res.error || "Scan failed", 409);
  return { childName: res.name, action };
}

export async function endTripNow(busId: number) {
  const ctx = await tripOfBus(busId);
  if (!ctx) throw new UserError("No trip running.", 409);
  if (ctx.pos.atIdx !== ctx.plan.stops.length - 1) throw new UserError("You can end the trip at the last stop.", 409);
  return (await import("./sim")).endTrip(ctx.trip, ctx.plan, ctx.t);
}

export async function found(busId: number, childId: number) {
  const ctx = await tripOfBus(busId);
  if (!ctx) throw new UserError("No trip running.", 409);
  const r = await (await import("./sim")).foundChild(ctx.trip, ctx.plan, childId, ctx.t);
  if (!r.ok) throw new UserError(r.error || "Failed", 409);
}

export async function setAutoScan(busId: number, on: boolean) {
  await q("UPDATE trips SET auto_scan=$2 WHERE active AND bus_id=$1", [busId, on]);
}

// ---------- School ----------

export async function resolveAlert(alertId: number, resolution: string) {
  const [a] = await q<{ title: string; sim_time: number; trip_id: number }>(
    "UPDATE alerts SET resolved=TRUE, resolution=$2 WHERE id=$1 AND NOT resolved RETURNING title, sim_time, trip_id",
    [alertId, resolution || "Resolved by transport desk"]
  );
  if (!a) throw new UserError("Alert not found or already resolved.", 404);
  const [trip] = await q<TripRow>("SELECT * FROM trips WHERE id=$1", [a.trip_id]);
  await log("ok", `Resolved by desk: ${a.title} (${resolution})`, trip ? simMinutes(trip, Date.now()) : null);
}

// ---------- Parent ----------

export async function setRadius(childId: number, radiusM: number) {
  if (![300, 500, 1000, 2000].includes(radiusM)) throw new UserError("Radius must be 300, 500, 1000 or 2000 m");
  await q(
    "INSERT INTO parent_prefs (child_id, alert_radius_m) VALUES ($1,$2) ON CONFLICT (child_id) DO UPDATE SET alert_radius_m=$2",
    [childId, radiusM]
  );
}

export async function respondToEvent(eventId: number, response: string) {
  const [e] = await q<{ id: number; kind: string; trip_id: number | null; child_id: number }>(
    "UPDATE events SET response=$2 WHERE id=$1 AND response IS NULL RETURNING id, kind, trip_id, child_id",
    [eventId, String(response).slice(0, 80)]
  );
  if (!e) return; // already answered (e.g. on another phone): nothing to do
  const [c] = await q<{ name: string }>("SELECT name FROM children WHERE id=$1", [e.child_id]);
  const [trip] = e.trip_id ? await q<TripRow>("SELECT * FROM trips WHERE id=$1", [e.trip_id]) : [];
  const t = trip ? simMinutes(trip, Date.now()) : null;
  if (e.kind === "missed" && e.trip_id) {
    // The parent's answer goes straight into the school's attendance.
    await q("UPDATE attendance SET value=$3 WHERE trip_id=$1 AND child_id=$2", [e.trip_id, e.child_id, response]);
    await q("UPDATE alerts SET resolved=TRUE, resolution=$3 WHERE trip_id=$1 AND child_id=$2 AND type='missed'", [e.trip_id, e.child_id, response]);
    await log("ok", `Parent confirmed for ${c.name}: ${response}`, t);
  } else {
    await log("info", `Parent of ${c.name} answered “${response}” (${e.kind.replace(/_/g, " ")} alert)`, t);
  }
}

// A judge taps "Parent" on /join: give them a child nobody else has. Aarav (the presenter's) goes last.
export async function joinAsParent(): Promise<number> {
  const free = await q<{ id: number }>(
    `SELECT c.id FROM children c LEFT JOIN judge_claims j ON j.child_id=c.id
      WHERE c.status='active' AND c.bus_id IS NOT NULL AND j.child_id IS NULL
      ORDER BY (c.id = 1), (c.bus_id <> 4), c.id LIMIT 1`
  );
  let id = free[0]?.id;
  if (!id) {
    // Everyone is taken: reuse the oldest claim.
    const [old] = await q<{ child_id: number }>("SELECT child_id FROM judge_claims ORDER BY claimed_at LIMIT 1");
    id = old.child_id;
    await q("DELETE FROM judge_claims WHERE child_id=$1", [id]);
  }
  // ON CONFLICT: two judges racing for the same child -> the loser tries again.
  const ins = await q("INSERT INTO judge_claims (child_id) VALUES ($1) ON CONFLICT DO NOTHING RETURNING child_id", [id]);
  if (!ins.length) return joinAsParent();
  return id;
}

export async function tagInfo(code: string) {
  const [tag] = await q<{ code: string; child_id: number | null; registered: boolean }>("SELECT * FROM tags WHERE code=$1", [code.toUpperCase()]);
  if (!tag) return { exists: false, registered: false, child: null };
  let child = null;
  if (tag.child_id && tag.registered) {
    const [c] = await q("SELECT c.*, s.name AS stop_name FROM children c LEFT JOIN stops s ON s.id=c.stop_id WHERE c.id=$1", [tag.child_id]);
    if (c)
      child = { id: c.id, name: c.name, classSection: c.class_section, tagCode: c.tag_code, busId: c.bus_id, stopId: c.stop_id, stopName: c.stop_name, parentName: c.parent_name, maskedPhone: c.masked_phone, claimed: false };
  }
  return { exists: true, registered: tag.registered, child };
}

// Someone found a bag and pressed "Alert the parent". No phone number is ever shown to them.
export async function bagFound(code: string, message: string) {
  const info = await tagInfo(code);
  if (!info.child) throw new UserError("This tag is not registered.", 404);
  await addEvent(null, info.child.id, "bag_found", "amber", "info", { child: info.child.name.split(" ")[0], message: String(message || "").slice(0, 200) }, null, null);
  await log("info", `Someone scanned ${info.child.name}'s bag tag and alerted the parent (no number shared)`, null);
}

// ---------- Requests (new rider, change stop) ----------

export async function createRequest(body: any) {
  const stopId = Number(body.stopId);
  const [stop] = await q("SELECT * FROM stops WHERE id=$1 AND NOT is_school", [stopId]);
  if (!stop) throw new UserError("Pick a valid stop.");
  if (body.type === "new_rider") {
    const code = String(body.tagCode || "").toUpperCase();
    const name = String(body.name || "").trim().slice(0, 60);
    const cls = String(body.classSection || "").trim().slice(0, 5);
    if (!name || !cls) throw new UserError("Child name and class are needed.");
    const [tag] = await q("SELECT * FROM tags WHERE code=$1", [code]);
    if (!tag) throw new UserError("Unknown tag.", 404);
    if (tag.registered) throw new UserError("This tag is already registered.", 409);
    if (tag.child_id) throw new UserError("A registration for this tag is already waiting for approval.", 409);
    // The child is created as "pending" (not on any bus list until approved). Fake parent, masked number.
    const [c] = await q<{ id: number }>(
      `INSERT INTO children (school_id, name, class_section, tag_code, parent_name, masked_phone, status)
       VALUES (1,$1,$2,$3,$4,'+91 9•••••••00','pending') RETURNING id`,
      [name, cls, code, String(body.parentName || "Parent").slice(0, 60)]
    );
    await q("UPDATE tags SET child_id=$2 WHERE code=$1", [code, c.id]);
    await q("INSERT INTO requests (type, child_id, payload, effective_date) VALUES ('new_rider',$1,$2,CURRENT_DATE)", [c.id, JSON.stringify({ stopId })]);
    await log("info", `New rider request: ${name} (${cls}) → ${stop.name}`, null);
    return;
  }
  if (body.type === "stop_change") {
    const childId = Number(body.childId);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(body.effectiveDate) ? body.effectiveDate : new Date().toISOString().slice(0, 10);
    const [c] = await q("SELECT * FROM children WHERE id=$1 AND status='active'", [childId]);
    if (!c) throw new UserError("Child not found.", 404);
    if (c.stop_id === stopId) throw new UserError("That is already the child's stop.");
    await q("INSERT INTO requests (type, child_id, payload, effective_date) VALUES ('stop_change',$1,$2,$3)", [childId, JSON.stringify({ stopId }), date]);
    await log("info", `Stop change request: ${c.name} → ${stop.name} from ${date}`, null);
    return;
  }
  throw new UserError("Unknown request type.");
}

export async function listRequests(): Promise<RequestRow[]> {
  const rows = await q(
    `SELECT r.*, c.name AS child_name, c.class_section, c.tag_code, fs.name AS from_stop,
            ts.id AS to_id, ts.name AS to_stop, b.name AS to_bus
       FROM requests r
       LEFT JOIN children c ON c.id = r.child_id
       LEFT JOIN stops fs ON fs.id = c.stop_id
       LEFT JOIN stops ts ON ts.id = (r.payload->>'stopId')::int
       LEFT JOIN buses b ON b.id = ts.bus_id
      ORDER BY (r.status='pending') DESC, r.id DESC`
  );
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    childId: r.child_id,
    childName: r.child_name ?? "(removed)",
    classSection: r.class_section ?? "",
    fromStopName: r.type === "stop_change" ? r.from_stop : null,
    toStopId: r.to_id,
    toStopName: r.to_stop ?? "(deleted stop)",
    toBusName: r.to_bus ?? "",
    tagCode: r.type === "new_rider" ? r.tag_code : null,
    effectiveDate: new Date(r.effective_date).toISOString().slice(0, 10),
    status: r.status,
    createdText: new Date(r.created_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }),
  }));
}

export async function decideRequest(id: number, decision: "approve" | "reject") {
  const [r] = await q("SELECT * FROM requests WHERE id=$1", [id]);
  if (!r) throw new UserError("Request not found.", 404);
  if (r.status !== "pending") throw new UserError("Already decided.", 409);
  const [c] = await q("SELECT name FROM children WHERE id=$1", [r.child_id]);
  const payload = typeof r.payload === "string" ? JSON.parse(r.payload) : r.payload;
  const [stop] = await q("SELECT name FROM stops WHERE id=$1", [payload.stopId]);
  if (decision === "reject") {
    await q("UPDATE requests SET status='rejected' WHERE id=$1", [id]);
    if (r.type === "new_rider") {
      // Free the tag again so it can be registered properly.
      await q("UPDATE tags SET child_id=NULL WHERE child_id=$1", [r.child_id]);
    } else {
      await addEvent(null, r.child_id, "request_update", "red", "info", { type: r.type, status: "rejected", stop: stop?.name ?? "" }, null, null);
    }
    await log("info", `Desk rejected ${r.type === "new_rider" ? "new rider" : "stop change"}: ${c?.name}`, null);
    return;
  }
  await q("UPDATE requests SET status='approved' WHERE id=$1", [id]);
  await log("ok", `Desk approved ${r.type === "new_rider" ? "new rider" : "stop change"}: ${c?.name} → ${stop?.name}`, null);
  // Takes effect now if the date has come, otherwise applyDueRequests() does it on that date.
  const [due] = await q("SELECT (effective_date <= CURRENT_DATE) AS due FROM requests WHERE id=$1", [id]);
  if (due.due) await applyRequest(id);
}

// Make an approved request real: the child appears on the bus list / moves to the new stop.
export async function applyRequest(id: number) {
  const [r] = await q("UPDATE requests SET applied=TRUE WHERE id=$1 AND NOT applied RETURNING *", [id]);
  if (!r) return;
  const payload = typeof r.payload === "string" ? JSON.parse(r.payload) : r.payload;
  const [stop] = await q("SELECT * FROM stops WHERE id=$1", [payload.stopId]);
  if (!stop) return;
  if (r.type === "new_rider") {
    await q("UPDATE children SET status='active', bus_id=$2, stop_id=$3 WHERE id=$1", [r.child_id, stop.bus_id, stop.id]);
    await q("UPDATE tags SET registered=TRUE WHERE child_id=$1", [r.child_id]);
  } else {
    await q("UPDATE children SET bus_id=$2, stop_id=$3 WHERE id=$1", [r.child_id, stop.bus_id, stop.id]);
    // Leave the old bus's list if the trip hasn't picked them up yet.
    await q(
      "DELETE FROM attendance a USING trips t WHERE a.trip_id=t.id AND t.active AND a.child_id=$1 AND a.state IN ('waiting','atschool') AND t.bus_id<>$2",
      [r.child_id, stop.bus_id]
    );
    await addEvent(null, r.child_id, "request_update", "green", "info", { type: r.type, status: "approved", stop: stop.name }, null, null);
  }
  // Join today's active trip of the (new) bus, so the attendant sees the child right away.
  const [trip] = await q("SELECT * FROM trips WHERE active AND bus_id=$1 AND status IN ('running','paused')", [stop.bus_id]);
  if (trip) {
    await q(
      "INSERT INTO attendance (trip_id, child_id, state, value) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING",
      [trip.id, r.child_id, trip.kind === "morning" ? "waiting" : "atschool", trip.kind === "morning" ? "—" : "In class"]
    );
  }
}

// Nearest existing stops to a pin the parent dropped. The pin is used for this maths only, never saved.
export async function nearestStops(lat: number, lng: number): Promise<NearestStop[]> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new UserError("Bad pin.");
  const [stops, buses, seats] = await Promise.all([
    q("SELECT * FROM stops WHERE NOT is_school"),
    q("SELECT id, name, capacity FROM buses"),
    q("SELECT bus_id, COUNT(*)::int AS n FROM children WHERE status='active' AND bus_id IS NOT NULL GROUP BY bus_id"),
  ]);
  return stops
    .map((s) => {
      const b = buses.find((x) => x.id === s.bus_id)!;
      const used = seats.find((x) => x.bus_id === s.bus_id)?.n ?? 0;
      return {
        stop: { id: s.id, busId: s.bus_id, name: s.name, lat: s.lat, lng: s.lng, seq: s.seq, isSchool: s.is_school },
        busName: b.name,
        distanceM: Math.round(haversine({ lat, lng }, { lat: s.lat, lng: s.lng })),
        freeSeats: b.capacity - used,
      };
    })
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, 3);
}

// ---------- Route editor ----------

// After any stop change: renumber seq 0..n (school last), refetch the road from OSRM, bump the version.
async function rebuildRoute(busId: number) {
  const stops = await q("SELECT * FROM stops WHERE bus_id=$1 ORDER BY is_school, seq, id", [busId]);
  for (let i = 0; i < stops.length; i++) await q("UPDATE stops SET seq=$2 WHERE id=$1", [stops[i].id, i]);
  const route = await fetchRoadRoute(stops.map((s) => ({ lat: s.lat, lng: s.lng })));
  await q("UPDATE buses SET route=$2 WHERE id=$1", [busId, JSON.stringify(route)]);
  await q("UPDATE meta SET value = (value::int + 1)::text WHERE key='routes_version'");
  if (route.source === "straight") await log("info", "Road service unreachable: route drawn as straight lines", null);
}

export async function addStop(busId: number, name: string, lat: number, lng: number) {
  name = String(name || "").trim().slice(0, 40);
  if (!name) throw new UserError("Give the stop a name.");
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new UserError("Tap the map to place the stop.");
  const [school] = await q("SELECT seq FROM stops WHERE bus_id=$1 AND is_school", [busId]);
  if (!school) throw new UserError("Bus not found.", 404);
  await q("INSERT INTO stops (bus_id, name, lat, lng, seq) VALUES ($1,$2,$3,$4,$5)", [busId, name, lat, lng, school.seq - 0.5]);
  await rebuildRoute(busId);
}

export async function renameStop(id: number, name: string) {
  name = String(name || "").trim().slice(0, 40);
  if (!name) throw new UserError("Name can't be empty.");
  const [s] = await q("UPDATE stops SET name=$2 WHERE id=$1 RETURNING bus_id", [id, name]);
  if (!s) throw new UserError("Stop not found.", 404);
  await q("UPDATE meta SET value = (value::int + 1)::text WHERE key='routes_version'");
}

export async function moveStop(id: number, dir: "up" | "down") {
  const [s] = await q("SELECT * FROM stops WHERE id=$1", [id]);
  if (!s) throw new UserError("Stop not found.", 404);
  if (s.is_school) throw new UserError("The school is always the last stop.", 409);
  const others = await q("SELECT * FROM stops WHERE bus_id=$1 AND NOT is_school ORDER BY seq", [s.bus_id]);
  const i = others.findIndex((x) => x.id === id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= others.length) throw new UserError("Can't move further.", 409);
  await q("UPDATE stops SET seq=$2 WHERE id=$1", [others[i].id, others[j].seq]);
  await q("UPDATE stops SET seq=$2 WHERE id=$1", [others[j].id, others[i].seq]);
  await rebuildRoute(s.bus_id);
}

export async function deleteStop(id: number) {
  const [s] = await q("SELECT * FROM stops WHERE id=$1", [id]);
  if (!s) throw new UserError("Stop not found.", 404);
  if (s.is_school) throw new UserError("The school stop can't be deleted.", 409);
  const [used] = await q("SELECT COUNT(*)::int AS n FROM children WHERE stop_id=$1 AND status='active'", [id]);
  if (used.n > 0) throw new UserError(`${used.n} child(ren) use this stop. Move them first.`, 409);
  const [count] = await q("SELECT COUNT(*)::int AS n FROM stops WHERE bus_id=$1", [s.bus_id]);
  if (count.n <= 2) throw new UserError("A bus needs at least one stop besides the school.", 409);
  await q("DELETE FROM stops WHERE id=$1", [id]);
  await rebuildRoute(s.bus_id);
}

// keep the import used (addAlert is re-exported for API routes that may need it)
export { addAlert };
