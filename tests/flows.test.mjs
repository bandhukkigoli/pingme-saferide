// Flow test: the features around the trips (approvals, stop change, route editor, bag tag, judges).
// Usage: BASE=https://pingme-saferide.vercel.app node tests/flows.test.mjs   (default: localhost:3000)

const BASE = process.env.BASE || "http://localhost:3000";
let failures = 0;
async function api(path, body, method = body ? "POST" : "GET") {
  const res = await fetch(BASE + path, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json();
  return { ok: res.ok, status: res.status, ...json };
}
function check(cond, msg) {
  console.log(`  ${cond ? "✅" : "❌"} ${msg}`);
  if (!cond) failures++;
}
const today = new Date().toISOString().slice(0, 10);

console.log("▶ full reset");
await api("/api/admin/reset", { full: true });
await api("/api/admin/start", { scenario: "normal", kind: "morning", speed: 1, targetChildId: 1 });

console.log("▶ 3 judges join at the same time");
const joins = await Promise.all([api("/api/join", {}), api("/api/join", {}), api("/api/join", {})]);
const ids = joins.map((j) => j.childId);
check(new Set(ids).size === 3, `each judge got a different child (${ids.join(", ")})`);
check(!ids.includes(1), "Aarav stays free for the presenter");

console.log("▶ new rider via an unregistered tag");
let tag = await api("/api/tag/PM-BAG-9001");
check(tag.exists && !tag.registered, "PM-BAG-9001 is a fresh, unregistered tag");
let r = await api("/api/requests", { type: "new_rider", tagCode: "PM-BAG-9001", name: "Test Rider", classSection: "2-B", stopId: 3, parentName: "Demo Parent" });
check(r.ok, "registration request sent");
let reqs = (await api("/api/requests")).requests;
const nr = reqs.find((x) => x.type === "new_rider" && x.status === "pending");
check(!!nr, "desk sees the pending new rider");
await api(`/api/requests/${nr.id}`, { decision: "approve" });
let w = await api("/api/state");
const rider = w.buses.find((b) => b.busId === 4).riders.find((x) => x.name === "Test Rider");
check(!!rider, "approved rider appears on the Bus 4 attendant list");
tag = await api("/api/tag/PM-BAG-9001");
check(tag.registered, "tag is now registered");

console.log("▶ change my stop (nearest-stop suggestion → approval)");
const near = await api("/api/nearest?lat=30.7605&lng=76.7830");
check(near.stops?.[0]?.stop?.name === "Sector 11", `nearest stop to a pin in Sector 11 = ${near.stops?.[0]?.stop?.name}`);
check(near.stops?.[0]?.freeSeats > 0, "free seats shown");
r = await api("/api/requests", { type: "stop_change", childId: 2, stopId: near.stops[0].stop.id, effectiveDate: today });
check(r.ok, "stop change requested for Diya");
reqs = (await api("/api/requests")).requests;
const sc = reqs.find((x) => x.type === "stop_change" && x.status === "pending");
await api(`/api/requests/${sc.id}`, { decision: "approve" });
w = await api("/api/state?child=2");
check(w.me.child.stopName === "Sector 11", "Diya's stop is now Sector 11 (effective today)");
check(w.buses.find((b) => b.busId === 4).riders.find((x) => x.childId === 2).stopName === "Sector 11", "attendant list shows the new stop");
check(w.me.events.some((e) => e.kind === "request_update"), "parent was told it was approved");
r = await api("/api/requests", { type: "stop_change", childId: 3, stopId: 2, effectiveDate: "2099-01-01" });
reqs = (await api("/api/requests")).requests;
await api(`/api/requests/${reqs.find((x) => x.status === "pending").id}`, { decision: "approve" });
w = await api("/api/state?child=3");
check(w.me.child.stopName === "Sector 16", "future-dated change does NOT apply before its date");

console.log("▶ bag tag finder (no number shown)");
r = await api("/api/tag/PM-BAG-2207/found", { message: "Found near the gate" });
check(r.ok, "finder alerted the parent");
w = await api("/api/state?child=1");
check(w.me.events.some((e) => e.kind === "bag_found"), "Aarav's parent got a bag_found alert");
const pub = await api("/api/tag/PM-BAG-2207");
check(!JSON.stringify(pub).match(/\d{10}/), "no full phone number in the tag answer");

console.log("▶ route editor");
let routes = await api("/api/routes");
const before = routes.buses.find((b) => b.bus.id === 2).stops.length;
r = await api("/api/stops", { busId: 2, name: "Sector 7", lat: 30.7335, lng: 76.8035 });
check(r.ok, "added Sector 7 to Bus 2");
routes = await api("/api/routes");
let stops2 = routes.buses.find((b) => b.bus.id === 2).stops;
const added = stops2.find((s) => s.name === "Sector 7");
check(stops2.length === before + 1 && stops2[stops2.length - 1].isSchool, "new stop sits before the school");
await api(`/api/stops/${added.id}`, { name: "Sector 7 Market" }, "PATCH");
await api(`/api/stops/${added.id}/move`, { dir: "up" });
routes = await api("/api/routes");
stops2 = routes.buses.find((b) => b.bus.id === 2).stops;
const idx = stops2.findIndex((s) => s.id === added.id);
check(stops2[idx].name === "Sector 7 Market", "renamed");
check(idx === stops2.length - 3, "moved up one place");
check(routes.buses.find((b) => b.bus.id === 2).route.source === "osrm", "road re-fetched from OSRM");
r = await api(`/api/stops/${added.id}`, undefined, "DELETE");
check(r.ok, "deleted");
r = await api("/api/stops/1", undefined, "DELETE");
check(r.status === 409, "can't delete a stop children use");

console.log("▶ teacher view data");
w = await api("/api/state");
const classB = w.children.filter((c) => c.classSection === "3-B").map((c) => c.name);
check(classB.length === 3, `class 3-B has 3 children (${classB.join(", ")})`);

await api("/api/admin/reset", { full: true });
console.log(failures ? `\n❌ ${failures} check(s) failed` : "\n✅ all flow checks passed");
process.exit(failures ? 1 : 0);
