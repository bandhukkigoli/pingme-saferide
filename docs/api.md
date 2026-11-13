# API contract (all JSON). Shapes are in `lib/types.ts`.

Errors: HTTP 4xx with `{ "error": "plain English message" }`. Every POST answers `{ "ok": true, ... }` on success.
No login (demo mode). Clients poll `GET /api/state` every 1.5 s.

## Reading
| Method | Path | Answer |
|---|---|---|
| GET | `/api/state` | `World` (all buses, alerts, log, children). Add `?child=ID` to also get `me: ParentView`. |
| GET | `/api/routes` | `{ version: number, buses: BusRoute[] }` (stops + road geometry; refetch when `World.routesVersion` changes) |
| GET | `/api/requests` | `{ requests: RequestRow[] }` newest first |
| GET | `/api/tag/[code]` | `{ registered: boolean, exists: boolean, child: ChildLite \| null }` |
| GET | `/api/nearest?lat=..&lng=..` | `{ stops: NearestStop[] }` 3 nearest non-school stops. The pin is NOT stored. |

## Demo control (`/admin/demo`)
| POST | `/api/admin/start` | body `{ scenario, kind: "morning"\|"afternoon", speed: 1\|2\|4, targetChildId }` starts a fresh trip on EVERY bus (scenario only affects the target child) |
| POST | `/api/admin/pause` | toggles pause/resume of all active trips → `{ ok, paused: boolean }` |
| POST | `/api/admin/reset` | body `{ full?: boolean }`. Default: clears trips/alerts/events/log (keeps judge claims, requests). `full: true` rebuilds the whole DB from seed. |

## Attendant (`/bus/[busId]`)
| POST | `/api/scan` | body `{ busId, childId?, tagCode?, action?: "on"\|"off" }` (no action = toggle). Only works while the bus stands at a stop → else 409 `{error}`. Answers `{ ok, childName, action: "on"\|"off" }` |
| POST | `/api/trip/end` | body `{ busId }` → `{ ok, blocked: boolean, missing: string[] }` |
| POST | `/api/trip/found` | body `{ busId, childId }` (the "Found · scan off" button) |
| POST | `/api/trip/autoscan` | body `{ busId, on: boolean }` |

## School
| POST | `/api/alerts/resolve` | body `{ alertId, resolution }` (e.g. "Child confirmed safe") |
| POST | `/api/requests/[id]` | body `{ decision: "approve"\|"reject" }` |
| POST | `/api/stops` | body `{ busId, name, lat, lng }` adds a stop just before the school |
| PATCH | `/api/stops/[id]` | body `{ name }` rename |
| POST | `/api/stops/[id]/move` | body `{ dir: "up"\|"down" }` |
| DELETE | `/api/stops/[id]` | 409 if children use it or it is the school |
(Route changes re-fetch the road from OSRM and bump `routesVersion`.)

## Parent
| POST | `/api/prefs` | body `{ childId, radiusM: 300\|500\|1000\|2000 }` |
| POST | `/api/events/respond` | body `{ eventId, response }`. For a `missed` event use `"Absent, parent informed"` or `"Parent dropping"` (updates school attendance + resolves the alert). For alarms use `"I'm going"` or `"Dismissed"` (shown in the school log). |
| POST | `/api/join` | → `{ ok, childId }` assigns an unclaimed child (each judge gets a different one; when all are taken, reuses the oldest claim) |
| POST | `/api/tag/[code]/found` | body `{ message? }` "Found this bag" → parent gets a `bag_found` event. No number is ever shown. |
| POST | `/api/requests` | new rider: `{ type: "new_rider", tagCode, name, classSection, stopId, parentName }`; stop change: `{ type: "stop_change", childId, stopId, effectiveDate: "YYYY-MM-DD" }` |

## Event kinds → params (parent page renders text in EN or HI from these)
- `near` {bus, stop, child, distM, minutes, morning} amber, alarm "near"
- `arriving` {bus, stop, child, morning} amber, alarm "near"
- `boarded` {child, bus, stop, time} blue, info
- `reached_school` {child, time} green, info
- `dropped` {child, stop, time} green, info
- `missed` {child, bus, stop, time} red, alarm "red", needsResponse
- `wrong_stop` {child, stop, home, time} red, alarm "red"
- `not_scanned_off` {child, bus} red, alarm "red"
- `found_safe` {child, bus, time, morning} green, info
- `bag_found` {child, message} amber, info
- `request_update` {type, status, stop} green/red, info
