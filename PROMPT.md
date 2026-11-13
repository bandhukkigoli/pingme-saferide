# MASTER PROMPT: build PingME SafeRide tonight

You are the **Orchestrator** (lead engineer) for a 12-hour solo hackathon build. Read the SPEC section below (source of truth) and open `saferide-demo.html` to see exactly how it must look and behave. Then execute this plan end to end.

## The 3 rules (in priority order, they override everything below)
1. **Least tokens.** Each sub-agent gets ONLY the SPEC sections + files it needs (listed per agent below), never the whole repo or the full reference HTML. No re-reading files you already have. Short status messages. No long plans: plan in ≤15 lines, then build.
2. **As fast as possible.** Run independent work in PARALLEL (launch the agents of a wave in ONE message). Never wait on something that isn't a real dependency. Prefer simple, proven code over clever code.
3. **Deliver the promised product.** Every item in the Final acceptance checklist must be tested on the live URL. Speed never excuses a missing feature: cut polish before cutting features.

## Orchestration: Opus 5.5 leads, parallel waves
The Orchestrator runs on **Opus 5.5** (`claude-opus-5-5`). Sub-agent models: hard logic → Opus; UI build → Sonnet; tests/docs/screenshots → Sonnet (Haiku for simple doc chores).

| Wave | Runs in parallel | Starts when |
|---|---|---|
| **W0** | Orchestrator alone: scaffold, `lib/types.ts`, `db/schema.sql`, API contract (`docs/api.md`), Neon + Vercel hello deploy | now |
| **W1** | **A** (engine + APIs, Opus) ‖ **B** (parent UI, Sonnet) ‖ **C** (attendant + school + demo panel, Sonnet) ‖ **E** (README/EXPLAIN skeleton, PWA icons from logo, Haiku) | W0 committed |
| **W2** | **A** (attendance, escalation, approvals, nearest-stop, new-rider APIs) ‖ **B** (ALARM MODE, missed/wrong/left takeovers, change-stop, /t/[tag], /join, Hindi) ‖ **C** (role picker + role switcher bar, approvals inbox, route editor, teacher view, camera scan, /admin/qr) ‖ **D** (Playwright e2e for W1 features, Sonnet) | Phase 1 gate passed |
| **W3** | **D** (full e2e + 375 px review on prod) ‖ **E** (screenshots, CP3 hurdles) ‖ owners fix bugs D files | Phase 2 features merged |

Agent context budget (what each one reads):
- A: SPEC §5, §6, §7, §8 + `lib/types.ts` + `docs/api.md`.
- B: SPEC §5 (Parent + T1), §6, §10 + `lib/types.ts` + `docs/api.md` + ONLY the CSS block and parent markup of `saferide-demo.html`.
- C: SPEC §5 (Attendant, School), §6, §10 + `lib/types.ts` + `docs/api.md`.
- D: SPEC §6 + the Final acceptance checklist + `docs/api.md`.
- E: SPEC §1–3, §11 + file tree.

## Ground rules
- Do ALL setup, installs, fixes, testing and deployment yourself. Only stop for things that physically need me (a browser login to Vercel/Neon). When you need me, say exactly what to click, in one short message.
- Use parallel sub-agents (Task tool) for independent work, as assigned below. You own integration, git, and deploys.
- Keep code simple, readable, and commented in plain English. No heavy frameworks beyond what is listed.
- Never mark something done until it is tested. If a test fails: fix → re-test → only then tick it.
- Track everything in `PROGRESS.md` (checklist with ✅/❌ and timestamps). Log every real problem + fix in `HURDLES.md` as it happens (I need this for a 4 AM checkpoint).
- Commit after every working step (`git commit` with clear messages).

## Stack (fixed)
Next.js (App Router) + TypeScript + Tailwind · Postgres on **Neon via the Vercel Marketplace** (`@neondatabase/serverless`, plain SQL, a `db/schema.sql` + `db/seed.sql`) · Leaflet + react-leaflet + OpenStreetMap tiles (no API keys, no Google) · camera scan via the BarcodeDetector API with an `html5-qrcode` fallback · `qrcode` package for QR generation · Playwright for end-to-end tests · deploy to **Vercel production**.
Fallback if the cloud DB is blocked: local Postgres or SQLite + `next start` + a `cloudflared` tunnel, and tell me.

## Team (sub-agents) and ownership
| Agent | Owns | Must deliver |
|---|---|---|
| **Orchestrator (you, Opus)** | Plan, repo, shared types (`lib/types.ts`), API contracts, integration, deploys, final verification | A working, deployed app that matches SPEC.md |
| **A · Data & Engine** | `db/`, `lib/db.ts`, `lib/sim.ts` (advanceTrip, pure-function bus position, scenarios, escalation), all `/api/*` routes with server-side state validation | Engine unit tests passing for all 4 scenarios × both trips (mirror the reference demo's outcomes) |
| **B · Parent experience** | `/p/[childId]`, `/join`, `/t/[tagCode]` (finder + new-rider flows), takeover component (colour + sound + vibrate), stop-change flow (P7), Hindi/English strings, PWA manifest + logo icons | Pixel-close to the reference demo on a 375 px phone |
| **C · School & Attendant** | `/bus/[busId]` (camera scan + manual + End-trip block), `/school` dashboard, `/school/approvals`, `/school/routes`, `/teacher/[class]`, `/admin/demo`, `/admin/qr` | All school/attendant features in SPEC §5 working against the real API |
| **D · QA** | `tests/e2e/*.spec.ts` (Playwright) + manual checklist | Tests for every scenario, approvals, 3 judges joining in parallel, a 375 px screenshot review of every page; runs against the DEPLOYED URL; files bugs to the owners |
| **E · Docs & Pitch support** | `README.md` (1-minute run guide + live link), `EXPLAIN.md` (plain-English walkthrough of every file + one full request flow), `HURDLES.md` upkeep, `docs/screenshots/` | Screenshots of every key screen and state for my deck |

Agents work in parallel after the Orchestrator commits the shared types + DB schema (Phase 0). Agents B and C build against the API contract; they must not invent their own data shapes.

## Phases, deadlines (IST), and gates
**Phase 0, by 22:30: Foundations (Orchestrator + A)**
- Scaffold the app, Tailwind, the logo/favicon from the reference demo, `lib/types.ts`, `db/schema.sql`, `db/seed.sql`.
- Provision Neon via the Vercel Marketplace, run schema + seed, and deploy a "hello" page to production. Gate: live URL opens on my phone.

**Phase 1, by 00:15: Core loop LIVE (A, B, C in parallel)**
- Engine + APIs: start/pause/reset trip, state polling, scans, the lead alerts, missed bus, wrong stop, End-trip block, Found.
- Parent page (pass + map + timeline + takeovers), attendant page (manual scan + End trip), school dashboard (KPIs, map, alerts, log), `/admin/demo`.
- Gate (QA): the Normal scenario runs end to end on the deployed URL from 2 different devices, and every screen sees the same bus.

**Phase 2, by 03:30: Everything else**
- Attendance check + teacher view, escalation, approvals inbox, new-rider registration via an unregistered tag, Change my stop with the nearest-stop suggestion, route editor, `/join` with parallel judges, `/t/[tagCode]` finder flow, `/admin/qr`, camera scanning, Hindi/English, PWA.
- Gate (QA): all 4 scenarios × both trips pass e2e on the deployed URL; 3 parallel judges each get a different child; approvals change the attendant list.
- At 01:00, Agent E: drop screenshots of the core loop into `docs/screenshots/` (for my 01:30 checkpoint deck).
- At 03:30, Agent E: summarise `HURDLES.md` into `docs/CP3_hurdles.md` (5 hurdles, each: problem → how we solved it → what makes us different).

**Phase 3, by 06:00: Polish and harden**
- STRETCH (only if every Phase 2 gate passed by 03:30): wrap the deployed app as an Android APK with Capacitor (the Android SDK appears to be installed on this laptop) using native local notifications with a custom alarm sound; output `dist/SafeRide.apk`. Skip it without hesitation if it endangers the checklist.
- 375 px review of every page; loading/empty/error states; no console errors; Lighthouse mobile ≥ 85.
- "Reset demo" restores a clean state in under 2 s. Seed data is deterministic.
- Final full e2e run on production, then freeze. No changes after 06:30 except critical fixes.

## Final acceptance checklist (Orchestrator verifies personally, ticks in PROGRESS.md)
- [ ] Live production URL works on a phone with no login.
- [ ] Logo, favicon, PWA install icon = "Tag bus".
- [ ] Live ETA (km + min) always shown; radius chooser (300 m–2 km) shows minutes per option; the ring on the map matches the chosen radius; the bus follows real roads on the OSM map.
- [ ] Background-tab browser Notification fires for alerts.
- [ ] ALARM MODE: ringtone loops + vibration until 'I'm going'/'Dismiss'; red alerts always alarm; 'Bus is near' alarm/notification toggle works; the response shows on the school dashboard. Tested on a real Android phone.
- [ ] Normal morning: radius alert → arriving-now alert → boarded (blue) → reached school (green).
- [ ] Normal afternoon: boarded → radius/arriving alerts → dropped safely (green).
- [ ] Missed bus: red alert → parent answer updates the school attendance.
- [ ] Wrong stop: red alert to parent + school; the desk resolves it.
- [ ] Left on bus: End trip blocked → "Boarded but NOT in class" → escalation levels → Found → green → trip closes.
- [ ] Alerts fire on EVERY trip, morning and afternoon, with sound + vibration + full-screen colour.
- [ ] New rider via an unregistered tag → approval → appears on the attendant list.
- [ ] Change my stop → nearest-stop suggestion → approval → the attendant list + parent alerts use the new stop from the effective date.
- [ ] Route editor: add/rename/reorder/delete a stop; the map updates.
- [ ] Teacher view shows only that class.
- [ ] `/t/[tag]` finder flow alerts the parent with no number shown.
- [ ] Camera scan of a printed QR works on a real phone.
- [ ] `/join` role picker + role switcher bar on every page; 3 phones in different roles (parent, attendant, school) work together live.
- [ ] 3 judges via `/join` in parallel each get a different child; the presenter can target any of them with a scenario.
- [ ] Hindi/English toggle switches all alert texts.
- [ ] No real personal data, no person location stored (grep the code and confirm in EXPLAIN.md).
- [ ] README, EXPLAIN.md, HURDLES.md, docs/screenshots complete.

## How to talk to me
Short status at each phase gate: what's live, the URL, what's next, anything you need from me. Start now with Phase 0.

---

# PingME SafeRide: Product Spec (source of truth)

> Hackathon: VentureX @ PEC E-Summit'26, Problem 4 "Build the Super App (PingME)". Solo builder.
> Visual reference: `saferide-demo.html` (open it in a browser). The real app must look and behave like it, backed by a real database. Where the demo and this SPEC differ (e.g. the demo's "1/2 stops" alert and sketched map), THIS SPEC WINS: real OSM map, road-following route, distance radius + ETA.

## 1. One line
The PingME QR tag on a child's school bag is scanned on and off the school bus, so parents and the school always know where the **child** is, not just where the bus is.

## 2. Problem (pitch anchor)
Schools track buses, not children. In Noida, a sleeping UKG child was locked inside a parked school bus for about 7 hours. The school marked him absent, while transport records showed he had boarded. The data existed; nobody connected it.

## 3. What PingME already is
PingME sells QR/NFC tags (vehicle, bag, keys, pet, luggage). Anyone scans the tag with a normal phone camera (no app) and the owner is alerted, with the owner's phone number never exposed. Tagline: "Reach people, not their personal data." SafeRide reuses the **bag tag**.

## 4. Users and devices
| User | Device | Needs |
|---|---|---|
| Parent | Phone, mobile web, no install | Know the child is safe; know when to be at the stop |
| Bus attendant | Phone | Scan children on/off in under 2 s; close the trip safely |
| School transport desk | Laptop/tablet | See every bus and every child; act on alerts; manage riders and stops |
| Class teacher | Laptop/phone | Bus-vs-class mismatch alerts for their class |

## 5. Features (all must ship)
### Parent (alerts EVERY trip, morning and afternoon)
- P1 **Bus approaching (radius + ETA)**: the parent chooses an alert radius around their stop based on how far they live: 300 m / 500 m / 1 km / 2 km (default 1 km). The chooser shows the estimated warning time for each option, e.g. "1 km ≈ 4 min", computed from the bus's current average speed on this route. When the bus (measured along the road route) enters the radius: an amber alert "Bus 4 is 1 km away, about 4 min. Head to the stop now" (morning: "Send Aarav out"). A second "Arriving now" alert fires at 150 m.
- P1b **Live ETA always visible**: the parent page always shows "Bus 4 · 2.3 km away · ~9 min" (road distance remaining to their stop + ETA), updating with every poll. ETA = remaining road distance ÷ the bus's rolling average speed (fallback 18 km/h city average).
- P2 **Boarded**: "Aarav boarded Bus 4 at Sector 15, 7:51 AM".
- P3 **Missed bus (morning)**: if the bus departs the child's stop with no scan, a red alert with buttons "He's not going today" / "I'll drop him myself". The answer updates the school's attendance.
- P4 **Reached school** (morning) / **Dropped safely** (afternoon): green.
- P5 **Wrong stop** (afternoon): red alert to the parent and the school.
- P6 **Not scanned off**: red alert if the trip tries to close while the child is still on board.
- P7 **Change my stop**: the parent drops a pin at the new address and gets a suggestion of the nearest existing stop with its bus and free seats; the parent picks a start date; this sends a request to the desk.
- P8 **Register new rider**: scanning a fresh, unregistered bag tag lets the parent enter the child's name and class and pick a stop. The request goes to the desk.
- P10 **How parents are updated**: (1) the parent page/PWA polls every 1.5 s and shows in-app full-screen alerts; (2) when the tab is in the background, also fire a browser Notification (Notification API, permission asked once with a clear reason) so the phone shows it like an app notification; (3) roadmap (say it in the pitch, don't build): WhatsApp/SMS and native push via PingME's existing alert channel.
- P11 **ALARM MODE (must ship)**: a full-screen "incoming call"-style alarm (Tag bus logo, big title, looping ringtone via Web Audio + continuous vibration pattern) that keeps ringing until the parent taps "I'm going" or "Dismiss" (the response is logged and shown to the school). Per-alert setting on the parent page: "Bus is near" = Alarm or Notification (default Alarm); red alerts (missed bus, wrong stop, not scanned off) = ALWAYS Alarm, not switchable; boarded/dropped = Notification. On first open, show a one-tap "Turn on alarm sound" button (browsers need one tap before audio can play) and keep an AudioContext unlocked. When the tab is hidden, also fire a Notification with `requireInteraction: true` + vibrate, and resume ringing when the page becomes visible. Pitch line (not built): for red alerts in production, PingME places a masked phone call to the parent via its existing masked-call system, which works even when the app is closed.
- P9 Every key event triggers a **full-screen colour takeover** + sound + vibration: blue = on bus, amber = approaching, green = safe, red = alert. Info takeovers auto-dismiss; red ones stay until acknowledged.

### Attendant
- A1 Trip screen: bus, current/next stop, on-board count, child list with status chips.
- A2 **Scan bag tag**: phone camera QR scan (use the BarcodeDetector API with an html5-qrcode fallback) plus a manual "Scan on/Scan off" per child. Scanning the same tag toggles on or off based on state.
- A3 **End trip**: BLOCKED while any child is still on board. Shows "Check every seat" with each missing child and a "Found, scan off" button.
- A4 "Auto-scan (demo)" toggle: the simulator scans children automatically at their stops.

### School
- S1 **Transport dashboard**: live map of all buses, KPIs (on board, accounted for, open alerts), alerts list, live log.
- S2 **Bus vs class attendance check (the Noida fix)**: morning: any child scanned on but not scanned off at school, or not marked present, raises "Boarded but NOT in class 3-B".
- S3 **Escalation**: unresolved alerts escalate Attendant → Transport in-charge (3 min) → Principal (6 min). In demo time, use simulated minutes.
- S4 **Approvals inbox**: new-rider and stop-change requests → one-tap Approve/Reject. Approved changes take effect from their date and appear on the attendant list automatically.
- S5 **Route editor (simple)**: per bus, an ordered list of stops (add, rename, reorder with up/down, delete) + seats used/capacity. Stops are shown as pins on the map. No auto route-planning (state this honestly).
- S6 **Trip log**: every scan is timestamped (proof of safety).
- S7 **Teacher view** `/teacher/[class]`: class list with status (On bus / In class / Missed bus / Unaccounted) and mismatch alerts for that class only.

### PingME tie-in
- T1 Every bag tag has a public URL `/t/[tagCode]` (this is what the QR encodes). Opening it shows:
  (a) for an attendant/demo mode: Scan on/off actions;
  (b) for anyone else: PingME's classic "Found this bag? Alert the parent" (masked, no number shown);
  (c) if unregistered: the new-rider registration (P8).

## 6. Demo mode (judges must be able to use it alone)
- **Play any role (must ship)**: `/join` opens a role picker with big cards: **Parent · Bus driver/attendant · School transport desk · Class teacher · Admin (demo control)**. Picking Parent assigns an unused demo child (as below); picking Attendant opens `/bus/4`; School opens `/school`; Teacher opens `/teacher/3-B`; Admin opens `/admin/demo`. Every page has a slim **role switcher bar** at the top (Parent | Attendant | School | Teacher | Admin) so one person can hop between roles, and several phones can hold different roles in the SAME live world at once (e.g. judge A = parent, judge B = attendant scanning, laptop = school). No login in demo mode; the switcher remembers the last role in localStorage. Say in the pitch: production uses role-based login (parent, staff, admin).
- `/join` (Parent): one tap assigns the judge an unused demo child, then opens that child's parent page. Several judges can join at once and each gets a different child.
- `/admin/demo` (presenter panel): choose scenario (Normal / Missed bus / Wrong stop / Left on bus), trip (Morning/Afternoon), speed (1×/2×/4×), **scenario target child** (default Aarav; dropdown includes children already claimed by judges), Start, Pause, Reset.
- `/admin/qr`: printable sheet of all bag-tag QR codes (with child names) + a big QR for `/join`.
- Scenarios (identical behaviour to `saferide-demo.html`):
  1. Normal: approaching alerts → boarded → reached school / dropped safely.
  2. Missed bus (morning): target not scanned at their stop → bus departs → red alert → parent responds → attendance updated.
  3. Wrong stop (afternoon): target scanned off one stop early → red alert to parent + school → desk taps "Child confirmed safe".
  4. Left on bus (the Noida case, both trips): target never scanned off → End trip blocked → mismatch alert → escalates → attendant taps "Found" → green.

## 7. Data model (Postgres)
```
schools(id, name)
buses(id, school_id, name, capacity)
stops(id, bus_id, name, lat, lng, seq)
children(id, school_id, name, class_section, tag_code UNIQUE, bus_id NULL, stop_id NULL, parent_name, masked_phone, status: active|pending)
tags(code PK, child_id NULL, registered bool)            -- includes a few unregistered tags for the P8 demo
trips(id, bus_id, kind morning|afternoon, scenario, target_child_id, speed, started_at, paused_at, sim_minutes_offset, status running|paused|blocked|closed, last_processed_step int)
scans(id, trip_id, child_id, type on|off|found, stop_id, sim_time, created_at)
alerts(id, trip_id, child_id, type approaching|missed|wrong_stop|left_on_bus, level 0..2, resolved bool, resolution text, sim_time, created_at)
attendance(id, trip_id, child_id, value text)              -- "On bus", "In class", "Missed bus", "Absent, parent informed", ...
requests(id, type new_rider|stop_change, child_id NULL, payload jsonb, effective_date, status pending|approved|rejected, created_at)
parent_prefs(child_id PK, alert_radius_m int default 1000)
judge_claims(child_id PK, claimed_at)
```
Seed: 1 school (PEC Demo School), 2 buses (Bus 4: 7 stops; Bus 2: 5 stops), ~20 FAKE children (Indian names, classes 1-A..5-C), 3 unregistered tags. Bus 4 must include the six demo children from the reference demo: Aarav Sharma 3-B Sector 15, Diya Verma 2-A Sector 22, Kabir Singh 5-C Sector 16, Meera Gill 4-A Sector 11, Rohan Bansal 3-B Sector 35, Saanvi Arora 1-C Sector 14.
Bus 4 route (morning order): Sector 35 → Sector 22 → Sector 16 → Sector 15 → Sector 11 → Sector 14 → PEC School (Sector 12). Afternoon = reverse. Order stops so the route follows real roads without zigzagging (check against the real Chandigarh sector grid). Use real approximate public coordinates for the sector centres and PEC (verify via OpenStreetMap/Nominatim; these are public places, not people).

## 8. Simulation engine (serverless-safe, no background workers)
- The bus position is a **pure function of time**: `step = floor(elapsedSimMinutes / MIN_PER_STEP)`; each stop = dwell 1 sim-minute + 3 sim-minutes driving to the next. Elapsed = (now - started_at) × speed, minus pauses.
- `advanceTrip(tripId)` runs at the start of every state read/write: it processes every due step since `last_processed_step` **idempotently** (in a transaction, guarded by `UPDATE trips SET last_processed_step = $n WHERE id = $id AND last_processed_step < $n`), applying arrivals (lead alerts, auto-scans per scenario), departures (missed-bus check), the end of the route (auto End trip if auto-scan is on), and escalations.
- **Road-following route**: at seed time, fetch the driving route through each bus's stops ONCE from the free public OSRM server (`https://router.project-osrm.org/route/v1/driving/{lng,lat;...}?overview=full&geometries=geojson`, no key), store the polyline + cumulative distance per point + each stop's distance-along-route in the DB (`route_geometry` table or a JSON column on buses). If OSRM is unreachable, fall back to straight lines and log it in HURDLES.md. The bus position = a point at distance d(t) along the polyline (it stops at each stop for the dwell time); this gives real road distances for P1/P1b.
- Clients poll `GET /api/state?trip=…&child=…` every 1.5 s. No websockets.
- Only the BUS is ever located. Never store or request any person's location (hackathon rule: no real personal data). The P7 address pin is placed by the user on the map and only used to compute the nearest stop; store only the chosen stop, not the pin.

## 9. Pages
`/` landing (what it is + role links + "Try it as a parent" → /join) · `/join` · `/p/[childId]` parent · `/bus/[busId]` attendant · `/school` transport desk · `/school/approvals` · `/school/routes` · `/teacher/[class]` · `/t/[tagCode]` tag landing · `/admin/demo` · `/admin/qr`.

## 10. Design (option E, "combo")
- Parent: an "Alert me when the bus is within: 300 m · 500 m · 1 km · 2 km" segmented control, each option labelled with its estimated minutes ("≈ 4 min"), and the dashed radius ring on the map = the chosen distance, drawn to real scale.
- Parent: **child pass card** on top (teal header: avatar initials, name, class, tag code; grid: Bus, Home stop, Status chip, Arrives; dashed tear-line footer "Last scan … by attendant Ravi") → **live map** (Leaflet + OpenStreetMap tiles, bus marker "4", dashed radius ring around the home stop) → "Alert me before my stop: 1/2 stops" → **day timeline**.
- **Full-screen colour takeover** for events (see P9).
- Logo: "Tag bus" (rounded teal square, light tag shape with a hole, bus front inside). The SVG is in `saferide-demo.html` header; reuse it as the favicon + app icon + PWA manifest icon.
- Colours: teal #0F6E56 / #1D9E75 / #E1F5EE; status blue #185FA5, amber #BA7517, green #3B6D11, red #A32D2D. Neutral white base. Try to pull PingME's exact brand colour from plzpingme.com CSS; if it differs, use it as the accent.
- One primary button per screen, tap targets ≥ 48 px, Hindi/English toggle (हिं / EN) on parent + attendant screens (at least all alert texts and buttons), phone numbers always masked, mobile-first.
- Installable PWA (manifest + icon) so it "feels like an app" when added to the home screen.

## 11. Rules
- No real personal data. No person tracking. Masked numbers only.
- Every screen works on a 375 px wide phone.
- Plain, commented code. The builder (a first-year student) must be able to explain every file.

## 12. Out of scope (say so in the pitch)
Real SMS/WhatsApp/push delivery (in-app alerts only tonight), automatic route planning, payments, Excel bulk import (mention as roadmap), native app background geofencing.
