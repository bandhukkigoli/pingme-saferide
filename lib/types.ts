// Shared data shapes used by BOTH the server (API routes) and the pages.
// If you change a shape here, every page that reads it must follow. See docs/api.md.

export type TripKind = "morning" | "afternoon";
export type Scenario = "normal" | "missed" | "wrong" | "left";
export type TripStatus = "idle" | "running" | "paused" | "blocked" | "closed";
// Where a child is during one trip.
// waiting = at home stop (morning), atschool = still at school (afternoon),
// onboard = scanned on, dropped = scanned off (or found), missed = bus left without them.
export type RiderState = "waiting" | "atschool" | "onboard" | "dropped" | "missed";
export type Color = "blue" | "amber" | "green" | "red";
export type AlertType = "missed" | "wrong_stop" | "left_on_bus";

export interface Stop {
  id: number;
  busId: number;
  name: string;
  lat: number;
  lng: number;
  seq: number; // order in the MORNING route, 0 = first pickup
  isSchool: boolean;
}

export interface Bus {
  id: number;
  name: string; // "Bus 4"
  capacity: number;
  seatsUsed: number; // active children assigned to this bus
}

// The road the bus drives, in MORNING order (afternoon = the same road reversed).
export interface RouteGeo {
  coords: [number, number][]; // [lat, lng] points along the real road (from OSRM)
  cum: number[]; // metres from the start of the route to each point
  stopDist: number[]; // metres from the start to each stop, same order as stops (by seq)
  total: number; // total route length in metres
  source: "osrm" | "straight"; // straight = OSRM was unreachable, we drew straight lines
}

// Static map data, fetched once by pages from GET /api/routes.
export interface BusRoute {
  bus: Bus;
  stops: Stop[]; // sorted by seq (morning order)
  route: RouteGeo;
}

export interface ChildLite {
  id: number;
  name: string;
  classSection: string; // "3-B"
  tagCode: string; // "PM-BAG-2207"
  busId: number | null;
  stopId: number | null;
  stopName: string | null;
  parentName: string; // fake
  maskedPhone: string; // always masked, e.g. "+91 98•••••210"
  claimed: boolean; // a judge picked this child via /join
}

export interface TripInfo {
  id: number;
  busId: number;
  kind: TripKind;
  scenario: Scenario;
  targetChildId: number | null;
  speed: number; // 1, 2 or 4
  status: TripStatus;
  autoScan: boolean;
  simClock: number; // simulated minutes since midnight, e.g. 451 = 7:31 AM
  simClockText: string; // "7:31 AM"
}

// Where the bus is right now.
export interface BusLive {
  busId: number;
  lat: number;
  lng: number;
  distAlong: number; // metres travelled along the route in the CURRENT trip direction
  atStopId: number | null; // the stop the bus is standing at, or null while driving
  nextStopId: number | null;
  line: string; // "At Sector 15" / "Driving to Sector 11" / "Trip closed"
  onBoard: number;
  avgSpeedMpm: number; // average speed, metres per simulated minute (fallback 300 = 18 km/h)
}

export interface Rider {
  childId: number;
  name: string;
  classSection: string;
  stopId: number | null;
  stopName: string | null;
  state: RiderState;
  attendance: string; // "On bus", "In class", "Missed bus", "Boarded, NOT in class", ...
  boardTime: string | null; // "7:51 AM"
  dropTime: string | null;
  dropStopName: string | null;
}

export interface BusView {
  busId: number;
  busName: string;
  trip: TripInfo | null; // null = no trip started since the last reset
  live: BusLive;
  riders: Rider[];
  canEndTrip: boolean; // true when the bus stands at the last stop and the trip is not closed
}

export interface AlertRow {
  id: number;
  tripId: number;
  busId: number;
  childId: number;
  childName: string;
  classSection: string;
  type: AlertType;
  level: 0 | 1 | 2; // 0 Attendant, 1 Transport in-charge, 2 Principal
  levelName: string;
  resolved: boolean;
  resolution: string | null;
  title: string; // English, for the school screens
  detail: string;
  simTimeText: string;
}

export interface LogRow {
  id: number;
  kind: "scan" | "alert" | "ok" | "info";
  text: string;
  simTimeText: string;
}

// Kinds of parent notifications. The parent page turns kind + params into text (English or Hindi).
export type EventKind =
  | "near" // bus entered the chosen radius
  | "arriving" // bus within 150 m
  | "boarded"
  | "reached_school"
  | "dropped"
  | "missed"
  | "wrong_stop"
  | "not_scanned_off"
  | "found_safe"
  | "bag_found"
  | "request_update";

export interface ParentEvent {
  id: number;
  tripId: number | null;
  childId: number;
  kind: EventKind;
  color: Color;
  // Which alarm rule applies on the parent page:
  // "near" = user setting (Alarm or Notification), "red" = ALWAYS alarm, "info" = notification only
  alarm: "near" | "red" | "info";
  needsResponse: boolean; // true for "missed": parent must pick an answer
  params: Record<string, string | number | boolean>;
  response: string | null;
  simTimeText: string;
}

export interface RadiusOption {
  m: number; // 300, 500, 1000, 2000
  minutes: number; // estimated warning time at the bus's average speed
}

export interface ParentView {
  child: ChildLite;
  busId: number | null;
  radiusM: number;
  radiusOptions: RadiusOption[];
  // Road distance + ETA from the bus to the child's stop (null if the bus already passed / no trip)
  eta: { distM: number; minutes: number } | null;
  rider: Rider | null;
  events: ParentEvent[]; // oldest first; this is the day timeline
  lastScanText: string; // "scanned on 7:51 AM by attendant Ravi" or "no scans yet today"
}

// GET /api/state answer.
export interface World {
  serverTime: number;
  routesVersion: number; // bumps when the route editor changes stops; refetch /api/routes then
  buses: BusView[];
  alerts: AlertRow[]; // newest first
  log: LogRow[]; // newest first, max 60
  children: ChildLite[];
  pendingRequests: number;
  me: ParentView | null; // only when ?child=ID is passed
}

export interface RequestRow {
  id: number;
  type: "new_rider" | "stop_change";
  childId: number | null;
  childName: string;
  classSection: string;
  fromStopName: string | null;
  toStopId: number;
  toStopName: string;
  toBusName: string;
  tagCode: string | null;
  effectiveDate: string; // YYYY-MM-DD
  status: "pending" | "approved" | "rejected";
  createdText: string;
}

export interface NearestStop {
  stop: Stop;
  busName: string;
  distanceM: number; // straight-line distance from the dropped pin
  freeSeats: number;
}
