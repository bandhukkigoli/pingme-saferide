# PROGRESS (times IST, 13–14 Nov 2026)

## Phase 0: Foundations
- ✅ 22:40 Next.js 16 + TypeScript + Tailwind scaffold, logo/favicon (`public/icon.svg`)
- ✅ 22:45 `lib/types.ts`, `db/schema.sql`, `db/seed.sql` (20 fake children, 2 buses, 3 unregistered tags), `docs/api.md`
- ✅ 22:40 Real road routes from OSRM cached in `db/routes.json` (Bus 4: 13.8 km, Bus 2: 7.9 km)
- ❌ Vercel project + Neon database: waiting for the one-click Vercel approval

## Phase 1: Core loop
- ✅ 23:25 Engine (`lib/sim.ts`): bus position = pure function of time, idempotent catch-up, radius + arriving alerts, missed bus, wrong stop, End-trip block, Found, escalation
- ✅ 23:25 All 21 API routes
- ✅ 23:20 Parent page, ALARM MODE, takeovers, Hindi/English, /join, /t/[tag], PWA (agent B)
- ✅ 23:15 Attendant, school, approvals, route editor, teacher, admin demo, admin QR, landing (agent C)
- ✅ 23:35 `node tests/engine.test.mjs`: all 4 scenarios × both trips PASS locally (31 checks)
- ✅ 23:40 Browser check at 375 px: parent page (map, ETA, radius ring, alarm), school desk, attendant
- ✅ 23:45 `next build` passes
- ❌ Deployed + tested on the live URL (blocked on Vercel approval)

## Final acceptance checklist (ticked only after testing on the LIVE URL)
- [ ] Live production URL works on a phone with no login
- [ ] Logo, favicon, PWA icon = "Tag bus"
- [ ] Live ETA, radius chooser with minutes, ring matches radius, bus on real roads
- [ ] Background-tab Notification
- [ ] ALARM MODE on a real Android phone
- [ ] Normal morning / Normal afternoon
- [ ] Missed bus → parent answer updates attendance
- [ ] Wrong stop → desk resolves
- [ ] Left on bus → blocked → escalation → Found → closed
- [ ] New rider via unregistered tag → approval → on attendant list
- [ ] Change my stop → nearest stop → approval → used from effective date
- [ ] Route editor add/rename/reorder/delete
- [ ] Teacher view shows only that class
- [ ] /t/[tag] finder flow, no number shown
- [ ] Camera scan of a printed QR on a real phone
- [ ] /join role picker + role bar; 3 phones in different roles
- [ ] 3 judges get different children; presenter can target any
- [ ] Hindi/English switches all alert texts
- [ ] No personal data / no person location (grep + EXPLAIN.md)
- [ ] README, EXPLAIN.md, HURDLES.md, docs/screenshots
