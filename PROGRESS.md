# PROGRESS (times IST, 13–14 Nov 2026)

Live: **https://pingme-saferide.vercel.app** (Vercel production + Neon Postgres via Vercel Marketplace)

## Phase 0: Foundations
- ✅ 22:40 Next.js 16 + TypeScript + Tailwind scaffold, logo/favicon (`public/icon.svg`)
- ✅ 22:45 `lib/types.ts`, `db/schema.sql`, `db/seed.sql` (20 fake children, 2 buses, 3 unregistered tags), `docs/api.md`
- ✅ 22:40 Real road routes from OSRM cached in `db/routes.json` (Bus 4: 13.8 km, Bus 2: 7.9 km)
- ✅ 00:05 Vercel project created + deployed via the already-logged-in Vercel CLI
- ✅ 00:15 Neon Postgres provisioned via Vercel Marketplace, connected, redeployed

## Phase 1: Core loop
- ✅ 23:25 Engine (`lib/sim.ts`) + all 21 API routes
- ✅ 23:20 Parent / attendant / school / admin pages (agents B + C)
- ✅ 23:35 Engine test passes locally
- ✅ 00:20 Engine test passes on the LIVE URL

## Phase 2: Everything else
- ✅ 00:35 `tests/flows.test.mjs` passes on LIVE: 3 judges join in parallel, new rider, stop change (today + future date), bag finder, route editor
- ✅ 00:50 19 screenshots at 375 px from LIVE in `docs/screenshots/`, no console errors, nothing wider than 375 px
- ✅ 00:55 README.md, EXPLAIN.md

## Final acceptance checklist (✅ = tested on the live URL by me; 📱 = needs a real phone, see README)
- ✅ Live production URL works with no login
- ✅ Logo, favicon, PWA manifest + 192/512 icons = "Tag bus" (all served 200)
- ✅ Live ETA (km + min) always shown; radius chooser shows minutes; ring = chosen radius; bus on real OSM roads (screenshots 04, 05, 09)
- 📱 Background-tab Notification (code done: `components/parent/alarm.ts`; needs a phone with the tab in background)
- 📱 ALARM MODE on a real Android phone (works in browser: screenshot 06; ringtone/vibration need a real phone)
- ✅ Normal morning: radius → arriving → boarded → reached school
- ✅ Normal afternoon: boarded → radius/arriving → dropped safely
- ✅ Missed bus: red alert → parent answer updates school attendance
- ✅ Wrong stop: red alert to parent + school; desk resolves
- ✅ Left on bus: End trip blocked → "Boarded but NOT in class" → escalation → Found (button OR tag scan) → green → trip closes
- ✅ Alerts on every trip, morning and afternoon (engine test, both kinds)
- ✅ New rider via unregistered tag → approval → on attendant list
- ✅ Change my stop → nearest stop → approval → attendant list + alerts use the new stop from the effective date
- ✅ Route editor: add / rename / reorder / delete; road re-fetched; map updates
- ✅ Teacher view shows only that class (screenshot 13)
- ✅ `/t/[tag]` finder flow alerts the parent, no number shown
- 📱 Camera scan of a printed QR (print `/admin/qr`; scanner code uses BarcodeDetector + html5-qrcode fallback)
- ✅ `/join` role picker + role switcher bar on every page
- 📱 3 phones in different roles live at once (server side verified: all screens read the same `/api/state`)
- ✅ 3 judges join in parallel → 3 different children; presenter can target any child
- ✅ Hindi/English toggle switches alert texts (screenshot 09)
- ✅ No real personal data, no person location (grep for geolocation APIs: no matches; EXPLAIN.md)
- ✅ README, EXPLAIN.md, HURDLES.md, docs/screenshots, docs/CP3_hurdles.md
