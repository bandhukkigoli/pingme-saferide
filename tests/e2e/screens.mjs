// Screenshot tour + 375 px review: drives the live demo through the key moments and saves a
// phone-sized screenshot of every screen into docs/screenshots/. Also reports browser console errors.
// Usage: BASE=https://pingme-saferide.vercel.app node tests/e2e/screens.mjs

import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE || "http://localhost:3000";
const OUT = "docs/screenshots";
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// API call with retries (a laptop on a phone hotspot sometimes drops a connection).
async function api(path, body, tries = 4) {
  try {
    const r = await fetch(BASE + path, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    return await r.json();
  } catch (e) {
    if (tries > 1) return api(path, body, tries - 1);
    throw e;
  }
}

const browser = await chromium.launch();
const errors = [];
// A phone: 375 px wide, touch, and the "alarm sound" banner already accepted.
async function phone(lang = "en") {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript((l) => {
    localStorage.setItem("saferide.soundReady", "1");
    localStorage.setItem("saferide.lang", l);
  }, lang);
  const page = await ctx.newPage();
  page.on("console", (m) => m.type() === "error" && errors.push(`${page.url()}: ${m.text()}`));
  page.on("pageerror", (e) => errors.push(`${page.url()}: ${e.message}`));
  return page;
}
async function shot(page, name, wait = 2500) {
  await sleep(wait);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  // 375 px review: nothing may be wider than the screen.
  const wide = await page.evaluate(() => document.documentElement.scrollWidth);
  if (wide > 380) errors.push(`${name}: page is ${wide}px wide at 375px (horizontal scroll)`);
  console.log("📸", name);
}

await api("/api/admin/reset", { full: true });
const p = await phone();

// Static screens
for (const [path, name] of [["/", "01-landing"], ["/join", "02-join-role-picker"], ["/admin/demo", "03-admin-demo"]]) {
  await p.goto(BASE + path);
  await shot(p, name);
}

// Normal morning at 1x: parent before, alarm, boarded; school + attendant mid-trip
await api("/api/admin/start", { scenario: "normal", kind: "morning", speed: 1, targetChildId: 1 });
await p.goto(BASE + "/p/1");
await shot(p, "04-parent-pass-map-eta");
await p.evaluate(() => window.scrollTo(0, 600));
await shot(p, "05-parent-radius-timeline", 500);
const school = await phone();
await school.goto(BASE + "/school");
const bus = await phone();
await bus.goto(BASE + "/bus/4");
// wait for the "bus is near" alarm (Aarav lives at Sector 15)
for (let i = 0; i < 60; i++) {
  const w = await api("/api/state?child=1");
  if (w.me.events.some((e) => e.kind === "near")) break;
  await sleep(1000);
}
await shot(p, "06-parent-ALARM-bus-is-near", 3000);
await shot(school, "07-school-dashboard-live", 0);
await shot(bus, "08-attendant-trip", 0);
const hi = await phone("hi");
await hi.goto(BASE + "/p/1");
await shot(hi, "09-parent-hindi");
await hi.context().close();

// Left on bus (Noida case), 4x
await api("/api/admin/reset", {});
await api("/api/admin/start", { scenario: "left", kind: "morning", speed: 4, targetChildId: 1 });
for (let i = 0; i < 90; i++) {
  const w = await api("/api/state?child=1");
  if (w.buses.find((b) => b.busId === 4).trip?.status === "blocked" && w.alerts.some((a) => a.level >= 1)) break;
  await sleep(1000);
}
await p.goto(BASE + "/p/1");
await shot(p, "10-parent-RED-not-scanned-off");
await bus.goto(BASE + "/bus/4");
await shot(bus, "11-attendant-trip-blocked-check-every-seat");
await school.goto(BASE + "/school");
await shot(school, "12-school-boarded-NOT-in-class-escalated");
await school.goto(BASE + "/teacher/3-B");
await shot(school, "13-teacher-3B-mismatch");

// Missed bus, 4x
await api("/api/admin/reset", {});
await api("/api/admin/start", { scenario: "missed", kind: "morning", speed: 4, targetChildId: 1 });
for (let i = 0; i < 60; i++) {
  const w = await api("/api/state?child=1");
  if (w.me.events.some((e) => e.kind === "missed")) break;
  await sleep(1000);
}
await p.goto(BASE + "/p/1");
await shot(p, "14-parent-RED-missed-bus");

// Tag pages, approvals, routes, QR
await p.goto(BASE + "/t/PM-BAG-2207");
await shot(p, "15-tag-found-this-bag");
await p.goto(BASE + "/t/PM-BAG-9002");
await shot(p, "16-tag-register-new-rider");
await api("/api/requests", { type: "stop_change", childId: 5, stopId: 2, effectiveDate: new Date().toISOString().slice(0, 10) });
await school.goto(BASE + "/school/approvals");
await shot(school, "17-school-approvals");
await school.goto(BASE + "/school/routes");
await shot(school, "18-school-route-editor");
await school.goto(BASE + "/admin/qr");
await shot(school, "19-admin-qr-sheet");

await browser.close();
await api("/api/admin/reset", { full: true });
console.log(errors.length ? `\n⚠️ ${errors.length} problem(s):\n` + [...new Set(errors)].join("\n") : "\n✅ no console errors, nothing wider than 375 px");
