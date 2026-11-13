// READ MODEL: turns database rows into the shapes the screens use (lib/types.ts).
// GET /api/state calls buildWorld(), which first catches every trip up (advanceAll).

import { q } from "./db";
import { advanceAll, avgSpeed, busAt, fmt, latLngAt, makePlan, simMinutes, startClock, LEVELS } from "./sim";
import type { AlertRow, BusRoute, BusView, ChildLite, LogRow, ParentEvent, ParentView, Rider, RiderState, World } from "./types";

const RADII = [300, 500, 1000, 2000];

// Apply approved requests whose start date has arrived (stop changes / new riders "from their date").
export async function applyDueRequests() {
  const due = await q<{ id: number }>("SELECT id FROM requests WHERE status='approved' AND NOT applied AND effective_date <= CURRENT_DATE");
  const { applyRequest } = await import("./actions");
  for (const r of due) await applyRequest(r.id);
}

export async function getRoutes(): Promise<{ version: number; buses: BusRoute[] }> {
  const [buses, stops, seats, meta] = await Promise.all([
    q("SELECT id, name, capacity, route FROM buses ORDER BY id DESC"),
    q("SELECT * FROM stops ORDER BY bus_id, seq"),
    q("SELECT bus_id, COUNT(*)::int AS n FROM children WHERE status='active' AND bus_id IS NOT NULL GROUP BY bus_id"),
    q("SELECT value FROM meta WHERE key='routes_version'"),
  ]);
  return {
    version: Number(meta[0]?.value ?? 1),
    buses: buses.map((b) => ({
      bus: { id: b.id, name: b.name, capacity: b.capacity, seatsUsed: seats.find((s) => s.bus_id === b.id)?.n ?? 0 },
      stops: stops
        .filter((s) => s.bus_id === b.id)
        .map((s) => ({ id: s.id, busId: s.bus_id, name: s.name, lat: s.lat, lng: s.lng, seq: s.seq, isSchool: s.is_school })),
      route: typeof b.route === "string" ? JSON.parse(b.route) : b.route,
    })),
  };
}

export async function buildWorld(childId: number | null): Promise<World> {
  const now = Date.now();
  // Approved requests and the bus catch-up don't depend on each other: run both at once.
  const [, { buses, trips }] = await Promise.all([applyDueRequests(), advanceAll(now)]);
  const tripIds = trips.map((t) => t.id);
  const tripIdList = tripIds.length ? tripIds : [-1];

  const [children, att, alerts, logs, claims, pending, meta, stopsAll] = await Promise.all([
    q("SELECT * FROM children WHERE status='active' ORDER BY id"),
    q("SELECT * FROM attendance WHERE trip_id = ANY($1)", [tripIdList]),
    q(
      `SELECT a.*, c.name AS child_name, c.class_section, t.bus_id, t.kind FROM alerts a
         JOIN children c ON c.id=a.child_id JOIN trips t ON t.id=a.trip_id
        WHERE a.trip_id = ANY($1) ORDER BY a.id DESC`,
      [tripIdList]
    ),
    q("SELECT * FROM logs ORDER BY id DESC LIMIT 60"),
    q("SELECT child_id FROM judge_claims"),
    q("SELECT COUNT(*)::int AS n FROM requests WHERE status='pending'"),
    q("SELECT value FROM meta WHERE key='routes_version'"),
    q("SELECT id, name FROM stops"),
  ]);
  const stopName = (id: number | null) => stopsAll.find((s) => s.id === id)?.name ?? null;
  const claimed = new Set(claims.map((c) => c.child_id));

  const childLite = (c: any): ChildLite => ({
    id: c.id,
    name: c.name,
    classSection: c.class_section,
    tagCode: c.tag_code,
    busId: c.bus_id,
    stopId: c.stop_id,
    stopName: stopName(c.stop_id),
    parentName: c.parent_name,
    maskedPhone: c.masked_phone,
    claimed: claimed.has(c.id),
  });

  const views: BusView[] = [];
  for (const [busId, b] of buses) {
    const trip = trips.find((t) => t.bus_id === busId) || null;
    const kind = trip?.kind ?? "morning";
    const plan = makePlan(busId, b.name, b.route, b.stops, kind);
    const t = trip ? simMinutes(trip, now) : 0;
    const pos = busAt(plan, t);
    const [lat, lng] = latLngAt(plan, kind, pos.d);
    const kids = children.filter((c) => c.bus_id === busId);
    // Riders = this bus's children + their state in the current trip (or the default before any trip).
    const riders: Rider[] = kids.map((c) => {
      const a = trip ? att.find((x) => x.trip_id === trip.id && x.child_id === c.id) : null;
      const state: RiderState = a?.state ?? "waiting";
      const base = startClock(kind);
      return {
        childId: c.id,
        name: c.name,
        classSection: c.class_section,
        stopId: c.stop_id,
        stopName: stopName(c.stop_id),
        state,
        attendance: a?.value ?? "—",
        boardTime: a?.board_sim != null ? fmt(base + a.board_sim) : null,
        dropTime: a?.drop_sim != null ? fmt(base + a.drop_sim) : null,
        dropStopName: a?.drop_stop_id ? stopName(a.drop_stop_id) : null,
      };
    });
    const onBoard = riders.filter((r) => r.state === "onboard").length;
    const atLast = pos.atIdx === plan.stops.length - 1;
    let line = "Waiting to start";
    if (trip) {
      if (trip.status === "closed") line = "Trip closed";
      else if (trip.status === "blocked") line = `At ${plan.stops[plan.stops.length - 1].name} · trip blocked`;
      else if (pos.atIdx !== null) line = `At ${plan.stops[pos.atIdx].name}`;
      else if (pos.nextIdx !== null) line = `Driving to ${plan.stops[pos.nextIdx].name}`;
      if (trip.status === "paused") line += " (paused)";
    }
    views.push({
      busId,
      busName: b.name,
      trip: trip
        ? {
            id: trip.id,
            busId,
            kind: trip.kind,
            scenario: trip.scenario,
            targetChildId: trip.target_child_id,
            speed: trip.speed,
            status: trip.status,
            autoScan: trip.auto_scan,
            simClock: startClock(trip.kind) + t,
            simClockText: fmt(startClock(trip.kind) + t),
          }
        : null,
      live: { busId, lat, lng, distAlong: pos.d, atStopId: pos.atIdx !== null ? plan.stops[pos.atIdx].id : null, nextStopId: pos.nextIdx !== null ? plan.stops[pos.nextIdx].id : null, line, onBoard, avgSpeedMpm: avgSpeed(plan, t) },
      riders,
      canEndTrip: !!trip && atLast && (trip.status === "running" || trip.status === "paused"),
    });
  }

  const alertRows: AlertRow[] = alerts.map((a) => ({
    id: a.id,
    tripId: a.trip_id,
    busId: a.bus_id,
    childId: a.child_id,
    childName: a.child_name,
    classSection: a.class_section,
    type: a.type,
    level: a.level,
    levelName: LEVELS[a.level],
    resolved: a.resolved,
    resolution: a.resolution,
    title: a.title,
    detail: a.detail,
    simTimeText: fmt(startClock(a.kind) + a.sim_time),
  }));

  // Log times: we show the trip clock of the newest trip kind (logs are simple text lines).
  const kindNow = trips[0]?.kind ?? "morning";
  const logRows: LogRow[] = logs.map((l) => ({ id: l.id, kind: l.kind, text: l.text, simTimeText: l.sim_time != null ? fmt(startClock(kindNow) + l.sim_time) : "" }));

  let me: ParentView | null = null;
  if (childId) {
    const c = (await q("SELECT * FROM children WHERE id=$1", [childId]))[0];
    if (c) me = await parentView(c, childLite(c), views, tripIdList, buses);
  }

  return {
    serverTime: now,
    routesVersion: Number(meta[0]?.value ?? 1),
    buses: views,
    alerts: alertRows,
    log: logRows,
    children: children.map(childLite),
    pendingRequests: pending[0]?.n ?? 0,
    me,
  };
}

async function parentView(c: any, child: ChildLite, views: BusView[], tripIds: number[], buses: Awaited<ReturnType<typeof advanceAll>>["buses"]): Promise<ParentView> {
  const [prefs, events] = await Promise.all([
    q("SELECT alert_radius_m FROM parent_prefs WHERE child_id=$1", [c.id]),
    q(
      `SELECT e.*, t.kind AS trip_kind FROM events e LEFT JOIN trips t ON t.id = e.trip_id
        WHERE e.child_id=$1 AND (e.trip_id = ANY($2) OR (e.trip_id IS NULL AND e.created_at > now() - interval '3 hours'))
        ORDER BY e.id`,
      [c.id, tripIds]
    ),
  ]);
  const radiusM = prefs[0]?.alert_radius_m ?? 1000;
  const view = views.find((v) => v.busId === c.bus_id);
  const rider = view?.riders.find((r) => r.childId === c.id) ?? null;
  const speed = view?.live.avgSpeedMpm ?? 300;

  // ETA: road distance from the bus to the child's stop, divided by the average speed.
  let eta: ParentView["eta"] = null;
  if (view) {
    // Re-use the bus routes already loaded for this request (no extra database trip).
    const br = buses.get(c.bus_id);
    if (br) {
      const kind = view.trip?.kind ?? "morning";
      const plan = makePlan(c.bus_id, view.busName, br.route, br.stops, kind);
      // Morning: the bus comes to the home stop. Afternoon: the bus brings the child to the home stop.
      // Once a child is on the morning bus, count down to school instead of to the home stop.
      const toSchool = kind === "morning" && rider?.state === "onboard";
      const idx = toSchool ? plan.stops.length - 1 : plan.stops.findIndex((s) => s.id === c.stop_id);
      const remaining = idx >= 0 ? plan.dist[idx] - view.live.distAlong : -1;
      const done = view.trip?.status === "closed" || view.trip?.status === "blocked";
      if (remaining >= 0 && !done) eta = { distM: Math.round(remaining), minutes: Math.max(remaining < 50 ? 0 : 1, Math.round(remaining / speed)) };
    }
  }

  const evs: ParentEvent[] = events.map((e) => ({
    id: e.id,
    tripId: e.trip_id,
    childId: e.child_id,
    kind: e.kind,
    color: e.color,
    alarm: e.alarm,
    needsResponse: e.needs_response,
    params: typeof e.params === "string" ? JSON.parse(e.params) : e.params,
    response: e.response,
    simTimeText: e.sim_time != null ? fmt(startClock(e.trip_kind ?? "morning") + e.sim_time) : "",
  }));

  let lastScanText = "no scans yet today";
  if (rider?.dropTime) lastScanText = `scanned off ${rider.dropTime} at ${rider.dropStopName} by attendant Ravi`;
  else if (rider?.boardTime) lastScanText = `scanned on ${rider.boardTime} by attendant Ravi`;

  return {
    child,
    busId: c.bus_id,
    radiusM,
    radiusOptions: RADII.map((m) => ({ m, minutes: Math.max(1, Math.round(m / speed)) })),
    eta,
    rider,
    events: evs,
    lastScanText,
  };
}
