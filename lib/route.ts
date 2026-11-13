// Road geometry helpers: get the real driving road between stops from OSRM,
// measure distances along it, and find the point at "d metres along the road".
// Only the BUS position is ever computed here. Nobody's personal location.

import type { RouteGeo } from "./types";

type LatLng = { lat: number; lng: number };

// Straight-line distance between two points on Earth, in metres (haversine formula).
export function haversine(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Turn a list of [lat,lng] points into a RouteGeo (adds the running distance per point).
function measure(coords: [number, number][], stops: LatLng[], source: RouteGeo["source"]): RouteGeo {
  const cum = [0];
  for (let i = 1; i < coords.length; i++) {
    const a = { lat: coords[i - 1][0], lng: coords[i - 1][1] };
    const b = { lat: coords[i][0], lng: coords[i][1] };
    cum.push(cum[i - 1] + haversine(a, b));
  }
  // For each stop, find the closest road point, searching forward only (the bus never drives back).
  const stopDist: number[] = [];
  let from = 0;
  for (const s of stops) {
    let best = from;
    let bestD = Infinity;
    for (let i = from; i < coords.length; i++) {
      const d = haversine(s, { lat: coords[i][0], lng: coords[i][1] });
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    stopDist.push(cum[best]);
    from = best;
  }
  stopDist[0] = 0;
  stopDist[stopDist.length - 1] = cum[cum.length - 1];
  return { coords, cum, stopDist, total: cum[cum.length - 1], source };
}

// Fallback when OSRM is unreachable: straight lines between stops.
export function straightRoute(stops: LatLng[]): RouteGeo {
  return measure(stops.map((s) => [s.lat, s.lng] as [number, number]), stops, "straight");
}

// Ask the free public OSRM server for the driving road through all stops (in order).
export async function fetchRoadRoute(stops: LatLng[]): Promise<RouteGeo> {
  if (stops.length < 2) return straightRoute(stops);
  const path = stops.map((s) => `${s.lng},${s.lat}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${path}?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const json = await res.json();
    const line: [number, number][] = json.routes[0].geometry.coordinates; // [lng, lat]
    return measure(line.map(([lng, lat]) => [lat, lng] as [number, number]), stops, "osrm");
  } catch (e) {
    console.warn("OSRM unreachable, using straight lines", e);
    return straightRoute(stops);
  }
}

// The [lat, lng] point that is d metres along the road (d is clamped to the route).
export function pointAt(route: RouteGeo, d: number): [number, number] {
  const { coords, cum } = route;
  if (d <= 0) return coords[0];
  if (d >= route.total) return coords[coords.length - 1];
  // Binary search for the segment that contains distance d.
  let lo = 0;
  let hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= d) lo = mid;
    else hi = mid;
  }
  const f = (d - cum[lo]) / (cum[hi] - cum[lo] || 1);
  return [coords[lo][0] + (coords[hi][0] - coords[lo][0]) * f, coords[lo][1] + (coords[hi][1] - coords[lo][1]) * f];
}
