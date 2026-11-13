// THE SIMULATION ENGINE (server only).
//
// Big idea: there is no background worker. The bus position is a pure function of time:
//   simulated minutes = (now - started_at - time spent paused) x speed x 0.625
// Every time any screen asks for the state, advanceTrip() "catches up": it processes every
// whole simulated minute ("step") that is due since last time: arrivals at stops, auto-scans,
// the missed-bus check when the bus departs, the end of the route, escalations and radius alerts.
// A compare-and-swap on trips.last_processed_step makes sure two phones polling at the same
// moment never process the same step twice (idempotent).
//
// Only the BUS is located. Children are never located: we only know "scanned on / off at stop X".

import { q } from "./db";
import { pointAt } from "./route";
import type { RouteGeo, TripKind, Scenario } from "./types";

// ---- Timing constants ----
export const SIM_MIN_PER_REAL_SEC = 0.625; // at 1x speed, one simulated minute = 1.6 real seconds
export const DWELL_MIN = 1; // the bus waits 1 simulated minute at each stop
export const DRIVE_MPM = 367; // simulated driving speed: 367 m per minute = 22 km/h city traffic
export const FALLBACK_MPM = 300; // 18 km/h, used for ETA before we have a measured average
export const ESCALATE_EVERY_MIN = 3; // Attendant -> Transport in-charge (3 min) -> Principal (6 min)
export const ARRIVING_M = 150; // "Arriving now" alert distance
export const LEVELS = ["Attendant", "Transport in-charge", "Principal"];

// ---- Small helpers ----

// 451 -> "7:31 AM"
export function fmt(simClock: number): string {
  const m = Math.floor(simClock);
  let h = Math.floor(m / 60);
  const mm = m % 60;
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(mm).padStart(2, "0")} ${ap}`;
}

// The clock time a trip starts at (simulated): 7:30 AM or 1:35 PM.
export const startClock = (kind: TripKind) => (kind === "morning" ? 7 * 60 + 30 : 13 * 60 + 35);

export interface TripRow {
  id: number;
  bus_id: number;
  kind: TripKind;
  scenario: Scenario;
  target_child_id: number | null;
  speed: number;
  started_at: string | number;
  paused_at: string | number | null;
  paused_total_ms: string | number;
  sim_minutes_offset: number;
  status: "running" | "paused" | "blocked" | "closed";
  auto_scan: boolean;
  last_processed_step: number;
  active: boolean;
}

export interface StopRow {
  id: number;
  bus_id: number;
  name: string;
  lat: number;
  lng: number;
  seq: number;
  is_school: boolean;
}

// Everything the engine needs to know about one bus for one trip direction.
export interface Plan {
  busId: number;
  busName: string;
  route: RouteGeo;
  stops: StopRow[]; // in TRIP order (afternoon = reversed)
  dist: number[]; // metres from the trip start to each stop, along the road
  arrive: number[]; // simulated minute the bus arrives at each stop
  depart: number[]; // simulated minute it leaves (arrive + dwell)
  endStep: number; // simulated minute the trip auto-ends (if auto-scan is on)
}

// Build the timetable of a trip: dwell 1 minute at each stop, then drive at 22 km/h to the next.
export function makePlan(busId: number, busName: string, route: RouteGeo, stopsMorning: StopRow[], kind: TripKind): Plan {
  const morningDist = route.stopDist;
  let stops = stopsMorning;
  let dist = morningDist;
  if (kind === "afternoon") {
    stops = [...stopsMorning].reverse();
    dist = [...morningDist].reverse().map((d) => route.total - d);
  }
  const arrive: number[] = [];
  const depart: number[] = [];
  let t = 0;
  for (let i = 0; i < stops.length; i++) {
    arrive.push(t);
    depart.push(t + DWELL_MIN);
    if (i < stops.length - 1) {
      const leg = dist[i + 1] - dist[i];
      t = t + DWELL_MIN + Math.max(2, Math.round(leg / DRIVE_MPM));
    }
  }
  return { busId, busName, route, stops, dist, arrive, depart, endStep: arrive[arrive.length - 1] + DWELL_MIN };
}

// How many simulated minutes have passed in this trip (pauses excluded).
export function simMinutes(trip: TripRow, nowMs: number): number {
  const end = trip.paused_at ? Number(trip.paused_at) : nowMs;
  const realMs = end - Number(trip.started_at) - Number(trip.paused_total_ms);
  return Math.max(0, trip.sim_minutes_offset + (realMs / 1000) * SIM_MIN_PER_REAL_SEC * trip.speed);
}

// Where is the bus at simulated minute t? Returns distance along the road + the stop it stands at.
export function busAt(plan: Plan, t: number): { d: number; atIdx: number | null; nextIdx: number | null } {
  const n = plan.stops.length;
  for (let i = 0; i < n; i++) {
    const nextArrive = i < n - 1 ? plan.arrive[i + 1] : Infinity;
    if (t < nextArrive) {
      if (t < plan.depart[i] || i === n - 1) return { d: plan.dist[i], atIdx: i, nextIdx: i < n - 1 ? i + 1 : null };
      // Driving: move linearly along the road between stop i and stop i+1.
      const f = (t - plan.depart[i]) / (nextArrive - plan.depart[i]);
      return { d: plan.dist[i] + f * (plan.dist[i + 1] - plan.dist[i]), atIdx: null, nextIdx: i + 1 };
    }
  }
  return { d: plan.dist[n - 1], atIdx: n - 1, nextIdx: null };
}

// [lat, lng] of a point that is d metres along the trip (handles the reversed afternoon direction).
export function latLngAt(plan: Plan, kind: TripKind, d: number): [number, number] {
  return pointAt(plan.route, kind === "morning" ? d : plan.route.total - d);
}

// Average speed so far (metres per simulated minute), with the 18 km/h fallback at the start.
export function avgSpeed(plan: Plan, t: number): number {
  const { d } = busAt(plan, t);
  if (t < 2 || d < 200) return FALLBACK_MPM;
  return d / t;
}

// ---- Loading ----

// Load buses + stops once and build a plan per bus for the given trip kind.
export async function loadPlans(): Promise<Map<number, { name: string; capacity: number; route: RouteGeo; stops: StopRow[] }>> {
  const [buses, stops] = await Promise.all([
    q<{ id: number; name: string; capacity: number; route: RouteGeo }>("SELECT id, name, capacity, route FROM buses ORDER BY id DESC"),
    q<StopRow>("SELECT * FROM stops ORDER BY bus_id, seq"),
  ]);
  const m = new Map();
  for (const b of buses) {
    const route = typeof b.route === "string" ? JSON.parse(b.route) : b.route;
    m.set(b.id, { name: b.name, capacity: b.capacity, route, stops: stops.filter((s) => s.bus_id === b.id) });
  }
  return m;
}

// ---- Writing helpers ----

export async function log(kind: "scan" | "alert" | "ok" | "info", text: string, simTime: number | null) {
  await q("INSERT INTO logs (kind, text, sim_time) VALUES ($1, $2, $3)", [kind, text, simTime]);
}

// Create a parent notification. dedupeKey makes it safe to call twice (second call does nothing).
export async function addEvent(
  tripId: number | null,
  childId: number,
  kind: string,
  color: string,
  alarm: "near" | "red" | "info",
  params: Record<string, unknown>,
  simTime: number | null,
  dedupeKey: string | null,
  needsResponse = false
): Promise<boolean> {
  const rows = await q(
    `INSERT INTO events (trip_id, child_id, kind, color, alarm, needs_response, params, sim_time, dedupe_key)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (dedupe_key) DO NOTHING RETURNING id`,
    [tripId, childId, kind, color, alarm, needsResponse, JSON.stringify(params), simTime, dedupeKey]
  );
  return rows.length > 0;
}

export async function addAlert(tripId: number, childId: number, type: string, title: string, detail: string, simTime: number) {
  const rows = await q(
    `INSERT INTO alerts (trip_id, child_id, type, title, detail, sim_time) VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (trip_id, child_id, type) DO NOTHING RETURNING id`,
    [tripId, childId, type, title, detail, simTime]
  );
  if (rows.length) await log("alert", title, simTime);
}

interface RiderRow {
  child_id: number;
  state: string;
  name: string;
  class_section: string;
  stop_id: number | null;
}

async function ridersOf(tripId: number): Promise<RiderRow[]> {
  return q<RiderRow>(
    `SELECT a.child_id, a.state, c.name, c.class_section, c.stop_id
       FROM attendance a JOIN children c ON c.id = a.child_id
      WHERE a.trip_id = $1 ORDER BY c.id`,
    [tripId]
  );
}

const firstName = (name: string) => name.split(" ")[0];

// ---- Actions: scan on / off, end trip, found ----

// Scan a child on or off at a stop. Used by the attendant (manual + camera) and by auto-scan.
export async function doScan(
  trip: TripRow,
  plan: Plan,
  childId: number,
  type: "on" | "off",
  stopIdx: number,
  simTime: number,
  manual: boolean
): Promise<{ ok: boolean; error?: string; name?: string }> {
  const [r] = await q<RiderRow & { tag_code: string }>(
    `SELECT a.child_id, a.state, c.name, c.class_section, c.stop_id, c.tag_code
       FROM attendance a JOIN children c ON c.id = a.child_id WHERE a.trip_id = $1 AND a.child_id = $2`,
    [trip.id, childId]
  );
  if (!r) return { ok: false, error: "This child is not on this bus's list today." };
  const stop = plan.stops[stopIdx];
  const clock = startClock(trip.kind) + simTime;
  const time = fmt(clock);
  const morning = trip.kind === "morning";
  const tag = manual ? " (manual)" : "";

  if (type === "on") {
    if (r.state === "onboard") return { ok: false, error: `${r.name} is already on board.` };
    if (r.state === "dropped") return { ok: false, error: `${r.name} was already scanned off today.` };
    // Compare-and-swap so a double tap cannot board twice.
    const upd = await q(
      `UPDATE attendance SET state='onboard', value='On bus', board_sim=$3 WHERE trip_id=$1 AND child_id=$2 AND state=$4 RETURNING child_id`,
      [trip.id, childId, simTime, r.state]
    );
    if (!upd.length) return { ok: false, error: "Already scanned." };
    await q("INSERT INTO scans (trip_id, child_id, type, stop_id, sim_time, manual) VALUES ($1,$2,'on',$3,$4,$5)", [trip.id, childId, stop.id, simTime, manual]);
    // A child who "missed" the bus but is scanned on after all: close the missed alert.
    if (r.state === "missed") await q("UPDATE alerts SET resolved=TRUE, resolution='Boarded after all' WHERE trip_id=$1 AND child_id=$2 AND type='missed'", [trip.id, childId]);
    await log("scan", `${r.name} scanned ON at ${stop.name}${tag}`, simTime);
    await addEvent(trip.id, childId, "boarded", "blue", "info", { child: firstName(r.name), bus: plan.busName, stop: stop.name, time }, simTime, `boarded:${trip.id}:${childId}`);
    return { ok: true, name: r.name };
  }

  // type === "off"
  if (r.state !== "onboard") return { ok: false, error: `${r.name} is not on board.` };
  const isHome = stop.id === r.stop_id;
  const value = stop.is_school ? (morning ? "In class" : "Handed to school") : isHome ? "Home stop ✓" : "Wrong stop";
  const upd = await q(
    `UPDATE attendance SET state='dropped', value=$3, drop_sim=$4, drop_stop_id=$5 WHERE trip_id=$1 AND child_id=$2 AND state='onboard' RETURNING child_id`,
    [trip.id, childId, value, simTime, stop.id]
  );
  if (!upd.length) return { ok: false, error: "Already scanned off." };
  await q("INSERT INTO scans (trip_id, child_id, type, stop_id, sim_time, manual) VALUES ($1,$2,'off',$3,$4,$5)", [trip.id, childId, stop.id, simTime, manual]);
  const ok = stop.is_school || isHome;
  await log(ok ? "scan" : "alert", `${r.name} scanned OFF at ${stop.name}${ok ? "" : " (not their stop)"}${tag}`, simTime);
  if (stop.is_school) {
    await addEvent(trip.id, childId, "reached_school", "green", "info", { child: firstName(r.name), time }, simTime, `school:${trip.id}:${childId}`);
  } else if (isHome) {
    await addEvent(trip.id, childId, "dropped", "green", "info", { child: firstName(r.name), stop: stop.name, time }, simTime, `dropped:${trip.id}:${childId}`);
  } else {
    const home = plan.stops.find((s) => s.id === r.stop_id)?.name ?? "their stop";
    await addAlert(trip.id, childId, "wrong_stop", `${r.name} got off at the wrong stop`, `Off at ${stop.name}, home stop is ${home} (${time})`, simTime);
    await addEvent(trip.id, childId, "wrong_stop", "red", "red", { child: firstName(r.name), stop: stop.name, home, time }, simTime, `wrong:${trip.id}:${childId}`);
  }
  return { ok: true, name: r.name };
}

// Try to close the trip. BLOCKED while any child is still on board (the Noida fix).
export async function endTrip(trip: TripRow, plan: Plan, simTime: number): Promise<{ blocked: boolean; missing: string[] }> {
  const riders = await ridersOf(trip.id);
  const left = riders.filter((r) => r.state === "onboard");
  if (!left.length) {
    const upd = await q("UPDATE trips SET status='closed' WHERE id=$1 AND status IN ('running','paused') RETURNING id", [trip.id]);
    if (upd.length) await log("ok", `${plan.busName} trip closed: every child accounted for`, simTime);
    return { blocked: false, missing: [] };
  }
  const upd = await q("UPDATE trips SET status='blocked' WHERE id=$1 AND status IN ('running','paused') RETURNING id", [trip.id]);
  if (!upd.length) return { blocked: true, missing: left.map((r) => r.name) };
  const morning = trip.kind === "morning";
  for (const r of left) {
    const [a] = await q<{ board_sim: number }>("SELECT board_sim FROM attendance WHERE trip_id=$1 AND child_id=$2", [trip.id, r.child_id]);
    const boarded = fmt(startClock(trip.kind) + (a?.board_sim ?? 0));
    if (morning) {
      await q("UPDATE attendance SET value='Boarded, NOT in class' WHERE trip_id=$1 AND child_id=$2", [trip.id, r.child_id]);
      await addAlert(trip.id, r.child_id, "left_on_bus", `${r.name} boarded but is NOT in class ${r.class_section}`, `Scanned on ${boarded}, never scanned off. ${plan.busName} can't close its trip.`, simTime);
    } else {
      await addAlert(trip.id, r.child_id, "left_on_bus", `${r.name} still on ${plan.busName}`, `Scanned on ${boarded}, never scanned off. ${plan.busName} can't close its trip.`, simTime);
    }
    await addEvent(trip.id, r.child_id, "not_scanned_off", "red", "red", { child: firstName(r.name), bus: plan.busName }, simTime, `left:${trip.id}:${r.child_id}`);
  }
  await log("alert", `${plan.busName} trip BLOCKED: ${left.length} child(ren) still on board`, simTime);
  return { blocked: true, missing: left.map((r) => r.name) };
}

// The attendant found a child still on the bus and scans them off.
export async function foundChild(trip: TripRow, plan: Plan, childId: number, simTime: number): Promise<{ ok: boolean; error?: string }> {
  const morning = trip.kind === "morning";
  const last = plan.stops[plan.stops.length - 1];
  const upd = await q<{ child_id: number }>(
    `UPDATE attendance SET state='dropped', value=$3, drop_sim=$4, drop_stop_id=$5 WHERE trip_id=$1 AND child_id=$2 AND state='onboard' RETURNING child_id`,
    [trip.id, childId, morning ? "In class" : "Handed to school", simTime, last.id]
  );
  if (!upd.length) return { ok: false, error: "This child is not marked on board." };
  const [c] = await q<{ name: string }>("SELECT name FROM children WHERE id=$1", [childId]);
  await q("INSERT INTO scans (trip_id, child_id, type, stop_id, sim_time, manual) VALUES ($1,$2,'found',$3,$4,TRUE)", [trip.id, childId, last.id, simTime]);
  await q("UPDATE alerts SET resolved=TRUE, resolution='Found on bus by attendant' WHERE trip_id=$1 AND child_id=$2 AND type='left_on_bus'", [trip.id, childId]);
  await log("ok", `${c.name} found on ${plan.busName} by the attendant, checked off`, simTime);
  await addEvent(trip.id, childId, "found_safe", "green", "info", { child: firstName(c.name), bus: plan.busName, time: fmt(startClock(trip.kind) + simTime), morning }, simTime, `found:${trip.id}:${childId}`);
  const still = (await ridersOf(trip.id)).filter((r) => r.state === "onboard");
  if (!still.length) {
    const closed = await q("UPDATE trips SET status='closed' WHERE id=$1 AND status='blocked' RETURNING id", [trip.id]);
    if (closed.length) await log("ok", `${plan.busName} trip closed: every child accounted for`, simTime);
  }
  return { ok: true };
}

// ---- The catch-up loop ----

// What happens when the bus ARRIVES at stop i (auto-scan per scenario).
async function onArrive(trip: TripRow, plan: Plan, i: number, t: number) {
  const riders = await ridersOf(trip.id);
  const stop = plan.stops[i];
  // "Arriving now" for parents of this stop, in case no phone polled during the last 150 m.
  // (dedupe key = same as the radius check, so it never fires twice)
  if (i > 0) {
    for (const r of riders) {
      const relevant = trip.kind === "morning" ? r.state === "waiting" : r.state === "onboard";
      if (relevant && r.stop_id === stop.id)
        await addEvent(trip.id, r.child_id, "arriving", "amber", "near", { bus: plan.busName, stop: stop.name, child: firstName(r.name), morning: trip.kind === "morning" }, t, `arriving:${trip.id}:${r.child_id}`);
    }
  }
  if (!trip.auto_scan) return;
  const last = i === plan.stops.length - 1;
  const target = trip.target_child_id;
  const sc = trip.scenario;
  for (const r of riders) {
    const isT = r.child_id === target;
    if (trip.kind === "morning") {
      if (last) {
        // At school: everyone gets off, except the target in the "left on bus" scenario (asleep on the bus).
        if (r.state === "onboard" && !(isT && sc === "left")) await doScan(trip, plan, r.child_id, "off", i, t, false);
      } else if (r.state === "waiting" && r.stop_id === stop.id && !(isT && sc === "missed")) {
        await doScan(trip, plan, r.child_id, "on", i, t, false);
      }
    } else {
      if (i === 0) {
        if (r.state === "atschool") await doScan(trip, plan, r.child_id, "on", i, t, false);
        continue;
      }
      if (r.state !== "onboard") continue;
      if (isT && sc === "left") continue; // never scanned off
      if (isT && sc === "wrong") {
        // Gets off ONE STOP EARLY (the stop just before home in the afternoon order).
        const homeIdx = plan.stops.findIndex((s) => s.id === r.stop_id);
        const early = Math.max(1, homeIdx - 1);
        if (i === early && early !== homeIdx) await doScan(trip, plan, r.child_id, "off", i, t, false);
        else if (i === homeIdx && early === homeIdx) await doScan(trip, plan, r.child_id, "off", i, t, false);
        continue;
      }
      if (r.stop_id === stop.id) await doScan(trip, plan, r.child_id, "off", i, t, false);
    }
  }
}

// What happens when the bus DEPARTS stop i: morning missed-bus check.
async function onDepart(trip: TripRow, plan: Plan, i: number, t: number) {
  if (trip.kind !== "morning") return;
  const stop = plan.stops[i];
  const time = fmt(startClock(trip.kind) + t);
  const riders = await ridersOf(trip.id);
  for (const r of riders) {
    if (r.state !== "waiting" || r.stop_id !== stop.id) continue;
    const upd = await q("UPDATE attendance SET state='missed', value='Missed bus' WHERE trip_id=$1 AND child_id=$2 AND state='waiting' RETURNING child_id", [trip.id, r.child_id]);
    if (!upd.length) continue;
    await addAlert(trip.id, r.child_id, "missed", `${r.name} missed ${plan.busName}`, `Not scanned at ${stop.name}, bus left ${time}. Parent asked to confirm.`, t);
    await addEvent(trip.id, r.child_id, "missed", "red", "red", { child: firstName(r.name), bus: plan.busName, stop: stop.name, time }, t, `missed:${trip.id}:${r.child_id}`, true);
  }
}

// Escalate unresolved alerts: Attendant -> Transport in-charge (3 sim-min) -> Principal (6 sim-min).
async function escalate(trip: TripRow, t: number) {
  const open = await q<{ id: number; level: number; sim_time: number; title: string }>(
    "SELECT id, level, sim_time, title FROM alerts WHERE trip_id=$1 AND NOT resolved",
    [trip.id]
  );
  for (const a of open) {
    const lvl = Math.min(2, Math.floor((t - a.sim_time) / ESCALATE_EVERY_MIN));
    if (lvl > a.level) {
      const upd = await q("UPDATE alerts SET level=$2 WHERE id=$1 AND level<$2 RETURNING id", [a.id, lvl]);
      if (upd.length) await log("alert", `Escalated to ${LEVELS[lvl]}: ${a.title}`, t);
    }
  }
  return open.length;
}

// Radius ("bus is near") and "arriving now" alerts, measured along the road.
// fromT..t = the stretch of simulated time since the previous check. We look at the whole stretch
// (every 0.1 sim-minute) so a fast bus can't slip through the radius between two polls.
async function radiusAlerts(trip: TripRow, plan: Plan, fromT: number, t: number) {
  if (trip.status === "closed") return;
  const { d } = busAt(plan, t);
  const riders = await q<RiderRow & { radius: number | null }>(
    `SELECT a.child_id, a.state, c.name, c.class_section, c.stop_id, p.alert_radius_m AS radius
       FROM attendance a JOIN children c ON c.id = a.child_id LEFT JOIN parent_prefs p ON p.child_id = a.child_id
      WHERE a.trip_id = $1`,
    [trip.id]
  );
  const morning = trip.kind === "morning";
  for (const r of riders) {
    const relevant = morning ? r.state === "waiting" : r.state === "onboard";
    if (!relevant) continue;
    const idx = plan.stops.findIndex((s) => s.id === r.stop_id);
    if (idx < 0) continue;
    if (idx === 0) continue; // first stop: the bus starts there, no warning needed
    const stop = plan.stops[idx].name;
    const radius = r.radius ?? 1000;
    const base = { bus: plan.busName, stop, child: firstName(r.name), morning };

    // "Bus is near": the first moment in fromT..t when the bus was inside the radius
    // but still more than 150 m away (and had not left the stop yet).
    for (let s = Math.max(0, fromT); s <= t + 1e-9; s = Math.min(t, s + 0.1)) {
      const rem = plan.dist[idx] - busAt(plan, s).d;
      if (rem > ARRIVING_M && rem <= radius && s < plan.depart[idx]) {
        const minutes = Math.max(1, Math.round(rem / avgSpeed(plan, s)));
        await addEvent(trip.id, r.child_id, "near", "amber", "near", { ...base, distM: Math.round(rem), minutes }, s, `near:${trip.id}:${r.child_id}`);
        break;
      }
      if (s >= t) break;
    }

    // "Arriving now": within 150 m right now (the stop-arrival step also fires it as a backup).
    const remaining = plan.dist[idx] - d;
    if (remaining >= 0 && remaining <= ARRIVING_M && t < plan.depart[idx]) {
      await addEvent(trip.id, r.child_id, "arriving", "amber", "near", base, t, `arriving:${trip.id}:${r.child_id}`);
    }
  }
}

// Catch a trip up to "now". Safe to call from many requests at once.
export async function advanceTrip(trip: TripRow, plan: Plan, nowMs: number): Promise<void> {
  const t = simMinutes(trip, nowMs);
  const target = Math.floor(t);
  const from = trip.last_processed_step + 1;
  // Radius alerts first, while children still have their pre-step state (waiting / on board).
  await radiusAlerts(trip, plan, Math.max(0, trip.last_processed_step), t);
  if (target >= from && (trip.status === "running" || trip.status === "paused")) {
    // Claim the steps [from..target]. If another request already claimed them, we skip.
    const claimed = await q("UPDATE trips SET last_processed_step=$2 WHERE id=$1 AND last_processed_step=$3 RETURNING id", [trip.id, target, trip.last_processed_step]);
    if (claimed.length) {
      for (let step = from; step <= target; step++) {
        for (let i = 0; i < plan.stops.length; i++) {
          if (plan.arrive[i] === step) await onArrive(trip, plan, i, step);
          if (plan.depart[i] === step && i < plan.stops.length - 1) await onDepart(trip, plan, i, step);
        }
        if (step === plan.endStep && trip.auto_scan) {
          const [fresh] = await q<TripRow>("SELECT * FROM trips WHERE id=$1", [trip.id]);
          if (fresh.status === "running") {
            await endTrip(fresh, plan, step);
            break;
          }
        }
      }
    }
  }
  const open = await escalate(trip, t);
  // Freeze the clock of a closed trip once nothing is left to resolve.
  if (trip.status === "closed" && !trip.paused_at && open === 0) {
    await q("UPDATE trips SET paused_at=$2 WHERE id=$1 AND paused_at IS NULL", [trip.id, nowMs]);
  }
}

// Load every active trip, catch each one up, return fresh rows + plans.
export async function advanceAll(nowMs = Date.now()) {
  const buses = await loadPlans();
  let trips = await q<TripRow>("SELECT * FROM trips WHERE active ORDER BY bus_id DESC");
  // Every bus is caught up at the same time (they don't depend on each other) = faster polls.
  await Promise.all(
    trips.map((tr) => {
      const b = buses.get(tr.bus_id);
      return b ? advanceTrip(tr, makePlan(tr.bus_id, b.name, b.route, b.stops, tr.kind), nowMs) : null;
    })
  );
  trips = await q<TripRow>("SELECT * FROM trips WHERE active ORDER BY bus_id DESC");
  return { buses, trips };
}

// Find the active trip of a bus + its plan, already caught up. Used by the action endpoints.
export async function tripOfBus(busId: number) {
  const { buses, trips } = await advanceAll();
  const trip = trips.find((t) => t.bus_id === busId) || null;
  const b = buses.get(busId);
  if (!trip || !b) return null;
  const plan = makePlan(busId, b.name, b.route, b.stops, trip.kind);
  const t = simMinutes(trip, Date.now());
  return { trip, plan, t, pos: busAt(plan, t) };
}
