# EXPLAIN: how PingME SafeRide works

Written so the builder can explain every file to the judges. Plain words, short sentences.

## (a) The big picture in 5 bullets

- A QR tag on each child's bag is scanned when the child gets on and off the bus. That is how we know where the **child** is (on bus, at school, at home stop).
- The **bus** is the only thing with a location. It moves along a real road. Its position is worked out from the clock, not from a GPS.
- There is no background worker. Every time a screen asks for the state, the server "catches up" everything that should have happened since the last ask, and saves it in Postgres.
- Every screen (parent, attendant, school, teacher) asks `GET /api/state` every 1.5 seconds. No websockets. Simple and works on Vercel.
- Privacy by design: no person's location is stored, all people are fake, phone numbers are masked.

## (b) Every source file

(Skipped: `node_modules`, `.next`, `.vercel`, `.pglite` (the local database folder), PNG icons, lock files.)

### Root files

| Path | What it does |
|---|---|
| `README.md` | The front page: pitch, live link, how to try and run it. |
| `EXPLAIN.md` | This file. |
| `HURDLES.md` | Log of problems we hit and how each was fixed. |
| `PROGRESS.md` | Build log with times and what is done. |
| `PROMPT.md` | The product spec and build plan (source of truth). |
| `CLAUDE.md` | Rules for the AI helper working on this project. |
| `AGENTS.md` | Note for AI helpers: this Next.js version has breaking changes, read its docs first. |
| `saferide-demo.html` | The original single-file demo that the real app copies in looks and behaviour. |
| `package.json` | List of packages and the commands (`dev`, `build`, `test:engine`, `routes`). |
| `next.config.ts` | Next.js settings: ship the `db/` folder with the API, keep PGlite outside the bundle. |
| `tsconfig.json` | TypeScript settings. |
| `postcss.config.mjs` | Turns on Tailwind CSS. |
| `next-env.d.ts` | Auto-made file that tells TypeScript about Next.js types. |
| `.env.local` | Private local settings (not shared). |
| `.gitignore` | Files git must not save. |

### `lib/` (the brain, runs on the server)

| Path | What it does |
|---|---|
| `lib/types.ts` | The shapes of all data (World, Rider, ParentEvent...) shared by server and pages. |
| `lib/db.ts` | Connects to Postgres: Neon on Vercel, PGlite on a laptop. Exposes `q("SQL", [params])`. |
| `lib/sim.ts` | The simulation engine: timetable, bus position, catch-up, scans, alerts, escalation. |
| `lib/world.ts` | Turns database rows into the `World` JSON that the screens read (`buildWorld`). |
| `lib/actions.ts` | All other writes: start/pause/reset demo, requests and approvals, route editor, parent settings, join, bag "found". |
| `lib/route.ts` | Road maths: fetch a road from OSRM, distances, "point at d metres along the road". |
| `lib/api.ts` | Small helper that wraps every API route and turns errors into `{ error }` JSON. |
| `lib/i18n.ts` | English and Hindi words for the parent and attendant screens. |

### `db/` (the data)

| Path | What it does |
|---|---|
| `db/schema.sql` | Creates all the tables. No table stores a person's location. |
| `db/seed.sql` | The fake demo data: 1 school, 2 buses, their stops, about 20 fake children, 3 unregistered tags. |
| `db/routes.json` | Saved road shapes from OSRM, so "Reset demo" works without internet. |

### `app/` (pages and API)

| Path | What it does |
|---|---|
| `app/layout.tsx` | The frame around every page: role bar on top, app icon and manifest. |
| `app/globals.css` | Global styles and colours copied from the demo. |
| `app/page.tsx` | Landing page. |
| `app/join/page.tsx` | Role picker; "Parent" gets a demo child and opens their page. |
| `app/p/[childId]/page.tsx` | The parent page: pass card, map, ETA, alert distance, timeline. |
| `app/bus/[busId]/page.tsx` | The attendant screen: scan children on/off, end trip, Hindi/English. |
| `app/school/page.tsx` | School desk: live map, counts, alerts, attendance, log. |
| `app/school/approvals/page.tsx` | Inbox where the school approves or rejects parents' requests. |
| `app/school/routes/page.tsx` | Route editor: reorder, rename, delete and add stops. |
| `app/teacher/[class]/page.tsx` | Teacher view for one class. |
| `app/t/[tagCode]/page.tsx` | Where a bag-tag QR lands: scan on/off, "Found this bag?", or register a rider. |
| `app/admin/demo/page.tsx` | Presenter panel: scenario, trip, speed, Start, Pause, Reset. |
| `app/admin/qr/page.tsx` | Printable sheet of QR codes. |
| `app/api/state/route.ts` | `GET /api/state`: the whole live world (polled every 1.5 s). |
| `app/api/routes/route.ts` | `GET /api/routes`: buses, stops and road shapes for the maps. |
| `app/api/nearest/route.ts` | `GET /api/nearest`: 3 nearest stops to a pin. The pin is not saved. |
| `app/api/join/route.ts` | `POST /api/join`: gives a judge an unused demo child. |
| `app/api/scan/route.ts` | `POST /api/scan`: attendant scans a bag tag on or off. |
| `app/api/trip/end/route.ts` | `POST /api/trip/end`: close the trip (blocked if a child is on board). |
| `app/api/trip/found/route.ts` | `POST /api/trip/found`: "Found, scan off" for a child left on the bus. |
| `app/api/trip/autoscan/route.ts` | `POST /api/trip/autoscan`: the "Auto-scan (demo)" switch. |
| `app/api/admin/start/route.ts` | `POST /api/admin/start`: start a fresh trip on every bus. |
| `app/api/admin/pause/route.ts` | `POST /api/admin/pause`: pause or resume all trips. |
| `app/api/admin/reset/route.ts` | `POST /api/admin/reset`: clear the live demo, or rebuild the whole database. |
| `app/api/alerts/resolve/route.ts` | `POST /api/alerts/resolve`: the desk closes an alert. |
| `app/api/events/respond/route.ts` | `POST /api/events/respond`: parent answers an alert ("I'm going", "Absent"...). |
| `app/api/prefs/route.ts` | `POST /api/prefs`: parent's alert distance (300 m to 2 km). |
| `app/api/requests/route.ts` | `GET/POST /api/requests`: list requests, or send a new-rider / stop-change request. |
| `app/api/requests/[id]/route.ts` | `POST /api/requests/[id]`: approve or reject a request. |
| `app/api/stops/route.ts` | `POST /api/stops`: add a stop. |
| `app/api/stops/[id]/route.ts` | `PATCH` renames a stop, `DELETE` removes it. |
| `app/api/stops/[id]/move/route.ts` | `POST`: move a stop up or down in the order. |
| `app/api/tag/[code]/route.ts` | `GET /api/tag/[code]`: is this bag tag registered, and to which child? |
| `app/api/tag/[code]/found/route.ts` | `POST`: "Found this bag" alert to the parent (number stays hidden). |

### `components/` (reusable screen pieces)

| Path | What it does |
|---|---|
| `components/usePoll.ts` | Asks a URL every 1.5 s and keeps the latest JSON. Also has `post()`. |
| `components/BusMap.tsx` | Loads the map only in the browser (Leaflet needs `window`). |
| `components/BusMapInner.tsx` | The real map: road, stops, bus marker, radius ring (OpenStreetMap tiles). |
| `components/Logo.tsx` | The "Tag bus" logo as an SVG. |
| `components/RoleBar.tsx` | Top bar to hop between Parent, Attendant, School, Teacher, Admin. |
| `components/parent/Takeover.tsx` | The full-screen coloured alert and alarm "incoming call". |
| `components/parent/alarm.ts` | Beeps, ringtone, vibration and phone notifications. |
| `components/parent/StopChange.tsx` | "Change my stop": drop a pin, see nearest stops, send a request. |
| `components/school/QrScanner.tsx` | Opens the camera and reads QR codes (BarcodeDetector, html5-qrcode backup). |
| `components/school/Toast.tsx` | Small message that floats at the bottom for a few seconds. |
| `components/school/useRoutes.ts` | Loads the map data and reloads it when the route editor changes something. |

### `public/`, `scripts/`, `tests/`, `docs/`

| Path | What it does |
|---|---|
| `public/icon.svg` | The logo as favicon and app icon. |
| `public/manifest.webmanifest` | Lets the site be installed on a phone's home screen (PWA). |
| `public/sw.js` | Tiny service worker: allows install and phone notifications. It caches nothing. |
| `scripts/fetch-routes.mjs` | Run once (`npm run routes`): asks OSRM for the road and saves `db/routes.json`. |
| `scripts/make-icons.mjs` | Makes the 192 and 512 pixel PNG icons from `icon.svg`. |
| `tests/engine.test.mjs` | Runs every scenario, morning and afternoon, through the real API and checks the results. |
| `docs/api.md` | List of every API endpoint and parent event type. |

## (c) One full request, step by step

Story: a parent's phone is open on `/p/1`. The bus is getting close.

1. **The phone asks.** `components/usePoll.ts` (used by `app/p/[childId]/page.tsx`) calls `GET /api/state?child=1`. It does this every 1.5 seconds.
2. **The route file answers.** `app/api/state/route.ts` reads `child=1` from the URL and calls `buildWorld(1)` from `lib/world.ts`.
3. **Catch up first.** `buildWorld` starts by calling `advanceAll()` in `lib/sim.ts`. This loads every active trip and calls `advanceTrip()` for each one.
4. **Work out the time.** `advanceTrip` calls `simMinutes()`: "how many simulated minutes have passed since this trip started?" Say the answer is 12.4. Whole minutes are called steps, so the target step is 12.
5. **Claim the steps.** The trip row remembers `last_processed_step` (say 10). The server runs `UPDATE trips SET last_processed_step=12 WHERE id=... AND last_processed_step=10`. If this changes one row, this request owns steps 11 and 12. If it changes zero rows, another phone got there first, and we skip. This is the compare-and-swap.
6. **Do what is due.** For each claimed step, `onArrive` and `onDepart` run: auto-scans, "arriving" alerts, the missed-bus check.
7. **Radius check.** `radiusAlerts()` finds how far the bus still is from the child's stop along the road. If that is inside the parent's chosen radius (default 1 km), it calls `addEvent(...)` with the kind `near`.
8. **Dedupe key.** The event is saved with the key `near:<tripId>:<childId>`. The `events` table has a unique rule on that key (`ON CONFLICT DO NOTHING`). So 100 polls inside the radius still make exactly one alert.
9. **Escalation.** `escalate()` raises old unresolved alerts to the next level (3 and 6 simulated minutes).
10. **Build the answer.** Back in `lib/world.ts`, `buildWorld` reads the trips, riders, alerts, log and this child's events, and builds one `World` object (shape in `lib/types.ts`), including `me` for child 1 (ETA, radius options, timeline).
11. **JSON goes back.** `lib/api.ts` (`handle`) sends it as JSON with `Cache-Control: no-store`.
12. **The phone shows it.** The parent page gets the new event list. `components/parent/Takeover.tsx` compares event ids with the highest one it has seen (saved in the phone's localStorage). A new `near` event is found. If the parent chose Alarm, it shows the full-screen "incoming call" with a ringtone and vibration (`components/parent/alarm.ts`) until the parent taps "I'm going" or "Dismiss". That tap calls `POST /api/events/respond`.

## (d) How the simulation works

- **No clock job, no GPS.** The bus position is a pure function of time. Same time in, same position out.
- **Time conversion.** At 1x speed, **1 simulated minute = 1.6 real seconds** (`SIM_MIN_PER_REAL_SEC = 0.625`). At 2x and 4x it is faster. Paused time is not counted.
- **The timetable** (`makePlan` in `lib/sim.ts`): at every stop the bus **waits 1 simulated minute (dwell)**. Then it **drives at 22 km/h** (367 m per minute) along the real road to the next stop. Each leg takes at least 2 minutes.
- **Trip clock.** A morning trip starts at 7:30 AM, an afternoon trip at 1:35 PM (simulated). The afternoon is the same road in reverse.
- **Where is the bus?** `busAt()` finds out if the bus is standing at a stop or driving between two. `latLngAt()` turns "d metres along the road" into a map point.
- **Steps.** Each whole simulated minute is one step. On arrival: "arriving now" alerts and auto-scans. On departure: the missed-bus check (morning only). At the end: auto End trip, which is blocked if a child is still on board.
- **Idempotency** (doing it twice is the same as doing it once). Two safety nets:
  1. The compare-and-swap on `trips.last_processed_step` means two phones never process the same step.
  2. Alerts and events have unique keys in the database, so the same alert can never be inserted twice. Scans use `UPDATE ... WHERE state=...` so a double tap cannot board a child twice.
- **ETA.** Remaining road distance divided by the bus's average speed so far (fallback 18 km/h).
- **Escalation.** An unresolved alert goes Attendant, then Transport in-charge after 3 simulated minutes, then Principal after 6.

## (e) Privacy check

- This command searches the code for any browser call that reads a device's position:

  ```bash
  grep -ri "geolocation\|getCurrentPosition\|watchPosition" app components lib
  ```

  **Result when we ran it: no matches.** The app never asks the phone where it is.
- **Only the bus is located.** Its position comes from the timetable in `lib/sim.ts`. Children are only known by their scans ("on at Sector 15", "off at school").
- **The "change my stop" pin** is placed by the parent on the map. It is sent to `/api/nearest` for distance maths and is never saved. Only the stop the parent picks is saved.
- **Phone numbers are masked** in the seed data (like `+91 98•••••210`). The real number is never stored or shown, not even to someone who scans a bag tag.
- **All data is fake.** Every child, parent and school in `db/seed.sql` is made up. The stop coordinates are public places in Chandigarh.
