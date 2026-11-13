# PingME SafeRide

**Track the child, not just the bus.** A QR tag on the school bag is scanned on and off the bus, so parents and the school always know where the *child* is.

Live demo (no login): **https://pingme-saferide.vercel.app**

Built for VentureX @ PEC E-Summit'26, Problem 4 "Build the Super App (PingME)".

## Try it in 1 minute

1. On a **phone**, open `/join` (https://pingme-saferide.vercel.app/join) and pick **Parent**. You get your own demo child.
2. On a **laptop**, open `/admin/demo`. Pick a scenario, then press **Start**.
3. Open `/school` (the school desk) and `/bus/4` (the bus attendant) in other tabs.
4. Watch your phone: it shows a live map, the ETA, and a full-screen alarm when the bus is near.

Several people can join at once. Each gets a different child. All of you share the same live world.

## The 4 scenarios

| Scenario | What happens |
|---|---|
| Normal day | Bus-near alerts, then "boarded", then "reached school" (morning) or "dropped safely" (afternoon). |
| Missed the bus (morning) | The target child is not scanned at their stop. The bus leaves. The parent gets a red alarm and answers. |
| Wrong stop (afternoon) | The child is scanned off one stop early. Red alert to the parent and the school. The desk taps "Child confirmed safe". |
| Left on bus (Noida case) | The child is never scanned off. "End trip" is blocked. The alert escalates until the attendant taps "Found". |

## Pages (one per role)

| Page | Who uses it | What it does |
|---|---|---|
| `/` | Everyone | Landing page: what this is and where to go. |
| `/join` | Everyone | Pick your role. Parent gets a free demo child. |
| `/p/[childId]` | Parent (phone) | Pass card, live map, ETA, alert distance, alarm setting, day timeline, change my stop. |
| `/bus/[busId]` | Bus attendant (phone) | Scan children on and off with the camera. End trip is blocked if a child is still on board. |
| `/school` | School transport desk | Live map, counts, alerts, attendance check, live log. |
| `/school/approvals` | School transport desk | Approve or reject parents' requests (new rider, stop change). |
| `/school/routes` | School transport desk | Edit the order of stops for each bus. |
| `/teacher/[class]` | Class teacher | Only one class: who is on the bus, in class, or missing. Example: `/teacher/3-B`. |
| `/t/[tagCode]` | Anyone who scans a bag tag | Attendant: scan on/off. Stranger: "Found this bag?". New tag: register a rider. |
| `/admin/demo` | Presenter | Pick scenario, trip, speed. Start, pause, reset. |
| `/admin/qr` | Presenter | Printable sheet of every bag-tag QR code and a big QR for `/join`. |

## Run it on your laptop

```bash
npm install
npm run dev
```

Then open http://localhost:3000. You do **not** need a database locally. The app uses PGlite (a real Postgres that runs inside Node and saves to the `.pglite` folder).

Run the automatic scenario tests while `npm run dev` is running (in a second terminal):

```bash
npm run test:engine
```

Test the live website instead:

```bash
BASE=https://pingme-saferide.vercel.app npm run test:engine
```

## How it is built (short)

- Next.js 16 (App Router) + TypeScript + Tailwind v4.
- Postgres: Neon on Vercel (Singapore region, next to the Vercel functions in `sin1`, close to India), PGlite on a laptop (see `lib/db.ts`).
- Map: Leaflet with free OpenStreetMap tiles.
- Road routes: the free OSRM server, saved in `db/routes.json` so the demo works offline.
- QR codes: the `qrcode` package. Camera scan: the browser's `BarcodeDetector`, with `html5-qrcode` as a backup.
- Live updates: every screen asks `GET /api/state` every 1.5 seconds. No websockets.
- The bus position is a pure function of time. `lib/sim.ts` catches up all due steps on each request.

For the full file-by-file tour, read [EXPLAIN.md](EXPLAIN.md).

## Privacy

- **Only the bus is located.** No person's location is ever asked for, saved or shown.
- The app has no code that reads a phone's GPS. (`grep -ri "geolocation\|getCurrentPosition\|watchPosition" app components lib` finds nothing.)
- When a parent drops a pin to change their stop, the pin goes to `/api/nearest` only for distance maths. It is never saved. Only the chosen stop is saved.
- **All people are fake.** Names, classes and parents are made up.
- **Phone numbers are stored masked** (like `+91 98•••••210`). The full number never exists in the database.
- A stranger who scans a bag tag can alert the parent. They never see the parent's number.

## Out of scope / roadmap

Not built tonight. Said honestly in the pitch:

- SMS, WhatsApp and native push alerts through PingME's existing alert channel (today: in-app alarm and browser notification only).
- A masked phone call to the parent for red alerts, using PingME's masked-call system. It would work even when the app is closed.
- Automatic route planning (today the school sets the stop order by hand).
- Excel import of children and stops.
- Role-based login for parents, staff and admins (today: no login, a role bar to hop between roles).

## More docs

- [EXPLAIN.md](EXPLAIN.md): what every file does, and one request followed step by step.
- [HURDLES.md](HURDLES.md): problems we hit and how we fixed them.
- [docs/api.md](docs/api.md): every API endpoint and the event types.
