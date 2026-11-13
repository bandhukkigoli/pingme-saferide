// Engine test: runs every demo scenario, morning AND afternoon, through the real API
// and checks the outcomes match saferide-demo.html.
// Usage:  node tests/engine.test.mjs            (local, http://localhost:3000)
//         BASE=https://your-app.vercel.app node tests/engine.test.mjs   (deployed)

const BASE = process.env.BASE || "http://localhost:3000";
const AARAV = 1;
let failures = 0;

async function api(path, body, method = body ? "POST" : "GET", tries = 3) {
  let res;
  try {
    res = await fetch(BASE + path, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  } catch (e) {
    // A dropped connection on a phone network is retried, like the real pages do on their next poll.
    if (tries > 1) return api(path, body, method, tries - 1);
    throw e;
  }
  const json = await res.json();
  if (!res.ok) throw new Error(`${path}: ${json.error}`);
  return json;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function check(cond, msg) {
  console.log(`  ${cond ? "✅" : "❌"} ${msg}`);
  if (!cond) failures++;
}
const bus4 = (w) => w.buses.find((b) => b.busId === 4);
const aarav = (w) => bus4(w).riders.find((r) => r.childId === AARAV);
const kinds = (w) => w.me.events.map((e) => e.kind);

// Poll until fn(world) is true (or time out).
async function until(fn, label, ms = 90000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const w = await api(`/api/state?child=${AARAV}`);
    if (fn(w)) return w;
    await sleep(700);
  }
  throw new Error("timeout waiting for " + label);
}

async function run(scenario, kind, body) {
  console.log(`\n▶ ${scenario} · ${kind}`);
  await api("/api/admin/reset", {});
  await api("/api/admin/start", { scenario, kind, speed: 4, targetChildId: AARAV });
  try {
    await body();
  } catch (e) {
    check(false, e.message);
  }
}

await api("/api/admin/reset", { full: true });

await run("normal", "morning", async () => {
  const w = await until((w) => ["closed", "blocked"].includes(bus4(w).trip.status), "trip end");
  const k = kinds(w);
  check(k.includes("near"), "radius alert (bus is near) fired");
  check(k.includes("arriving"), "arriving-now alert fired");
  check(k.indexOf("near") < k.indexOf("boarded"), "alerts came before boarding");
  check(k.includes("boarded") && k.includes("reached_school"), "boarded (blue) then reached school (green)");
  check(bus4(w).trip.status === "closed", "trip closed");
  check(aarav(w).attendance === "In class", "attendance = In class");
  check(w.alerts.length === 0, "no red alerts");
});

await run("normal", "afternoon", async () => {
  const w = await until((w) => ["closed", "blocked"].includes(bus4(w).trip.status), "trip end");
  const k = kinds(w);
  check(k[0] === "boarded", "boarded first (at school)");
  check(k.includes("near") && k.includes("arriving"), "radius + arriving alerts");
  check(k.includes("dropped"), "dropped safely (green)");
  check(aarav(w).attendance === "Home stop ✓", "drop-off = Home stop ✓");
  check(bus4(w).trip.status === "closed", "trip closed");
});

await run("missed", "morning", async () => {
  let w = await until((w) => w.me.events.some((e) => e.kind === "missed"), "missed alert");
  const ev = w.me.events.find((e) => e.kind === "missed");
  check(ev.alarm === "red" && ev.needsResponse, "missed = red alarm needing an answer");
  check(w.alerts.some((a) => a.type === "missed" && a.childId === AARAV), "school sees missed alert");
  await api("/api/events/respond", { eventId: ev.id, response: "Absent, parent informed" });
  w = await api(`/api/state?child=${AARAV}`);
  check(aarav(w).attendance === "Absent, parent informed", "parent answer updated school attendance");
  check(w.alerts.find((a) => a.type === "missed").resolved, "missed alert resolved");
  w = await until((w) => bus4(w).trip.status === "closed", "trip close");
  check(true, "trip closed");
});

await run("wrong", "afternoon", async () => {
  let w = await until((w) => w.alerts.some((a) => a.type === "wrong_stop"), "wrong stop alert");
  const a = w.alerts.find((a) => a.type === "wrong_stop");
  check(w.me.events.some((e) => e.kind === "wrong_stop" && e.alarm === "red"), "parent got red wrong-stop alarm");
  check(aarav(w).attendance === "Wrong stop", "drop-off = Wrong stop");
  await api("/api/alerts/resolve", { alertId: a.id, resolution: "Child confirmed safe" });
  w = await api(`/api/state?child=${AARAV}`);
  check(w.alerts.find((x) => x.id === a.id).resolved, "desk resolved it");
});

for (const kind of ["morning", "afternoon"]) {
  await run("left", kind, async () => {
    let w = await until((w) => bus4(w).trip.status === "blocked", "trip blocked");
    check(true, "End trip BLOCKED with child on board");
    check(w.me.events.some((e) => e.kind === "not_scanned_off"), "parent got red 'not scanned off'");
    if (kind === "morning") check(aarav(w).attendance === "Boarded, NOT in class", "attendance = Boarded, NOT in class");
    w = await until((w) => w.alerts.some((a) => a.type === "left_on_bus" && a.level >= 1), "escalation", 30000);
    check(true, "escalated to Transport in-charge");
    // A scan is refused while blocked; the attendant must use Found.
    await api("/api/trip/found", { busId: 4, childId: AARAV });
    w = await api(`/api/state?child=${AARAV}`);
    check(w.me.events.some((e) => e.kind === "found_safe"), "found → green");
    check(bus4(w).trip.status === "closed", "trip closes after Found");
  });
}

console.log(failures ? `\n❌ ${failures} check(s) failed` : "\n✅ all engine checks passed");
process.exit(failures ? 1 : 0);
