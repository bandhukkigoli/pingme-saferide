"use client";
// The live map (Leaflet + free OpenStreetMap tiles, no API key).
// Draws each bus's real road route, its stops, the bus marker, and optionally
// a dashed radius ring around the parent's home stop (drawn to real scale in metres).
// Do not import this file directly: use <BusMap/> from ./BusMap (it loads this only in the browser).

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, Circle, Marker, Tooltip, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import type { BusLive, BusRoute } from "@/lib/types";

export interface BusMapProps {
  routes: BusRoute[]; // from GET /api/routes
  live?: BusLive[]; // bus positions from GET /api/state (World.buses[i].live)
  height?: number; // pixels
  homeStopId?: number | null; // highlight this stop (parent's home stop)
  radiusM?: number | null; // dashed ring around the home stop, metres
  onlyBusId?: number | null; // show just one bus
  pin?: [number, number] | null; // a user-dropped pin (stop change / route editor)
  onMapClick?: (lat: number, lng: number) => void;
}

// A round teal marker with the bus number inside, like the reference demo.
function busIcon(label: string) {
  return L.divIcon({
    className: "",
    html: `<div style="width:28px;height:28px;border-radius:50%;background:#0F6E56;border:3px solid #fff;color:#fff;font-weight:700;font-size:12px;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,.35)">${label}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

const pinIcon = L.divIcon({
  className: "",
  html: `<div style="width:18px;height:18px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#BA7517;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 18],
});

// Zoom the map so every drawn route fits, once (and again if the routes change).
function FitBounds({ routes }: { routes: BusRoute[] }) {
  const map = useMap();
  const key = routes.map((r) => r.route.total).join(",");
  useEffect(() => {
    const pts = routes.flatMap((r) => r.route.coords);
    if (pts.length) map.fitBounds(L.latLngBounds(pts as L.LatLngExpression[]), { padding: [16, 16] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}

function ClickCatcher({ onMapClick }: { onMapClick?: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onMapClick?.(e.latlng.lat, e.latlng.lng) });
  return null;
}

export default function BusMapInner({ routes, live = [], height = 220, homeStopId, radiusM, onlyBusId, pin, onMapClick }: BusMapProps) {
  const shown = useMemo(() => (onlyBusId ? routes.filter((r) => r.bus.id === onlyBusId) : routes), [routes, onlyBusId]);
  const home = shown.flatMap((r) => r.stops).find((s) => s.id === homeStopId);

  return (
    <div style={{ height, borderRadius: 14, overflow: "hidden" }}>
      <MapContainer center={[30.745, 76.78]} zoom={13} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
        <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FitBounds routes={shown} />
        <ClickCatcher onMapClick={onMapClick} />
        {shown.map((r) => (
          <Polyline key={`road-${r.bus.id}`} positions={r.route.coords} pathOptions={{ color: "#1D9E75", weight: 5, opacity: 0.55 }} />
        ))}
        {home && radiusM ? (
          <Circle center={[home.lat, home.lng]} radius={radiusM} pathOptions={{ color: "#1D9E75", fillColor: "#1D9E75", fillOpacity: 0.08, dashArray: "6 6", weight: 2 }} />
        ) : null}
        {shown.flatMap((r) =>
          r.stops.map((s) => (
            <CircleMarker
              key={`stop-${s.id}`}
              center={[s.lat, s.lng]}
              radius={s.isSchool ? 8 : s.id === homeStopId ? 7 : 5}
              pathOptions={{ color: "#fff", weight: 2, fillOpacity: 1, fillColor: s.isSchool ? "#085041" : s.id === homeStopId ? "#0F6E56" : "#888780" }}
            >
              <Tooltip direction="top" offset={[0, -6]}>{s.name}</Tooltip>
            </CircleMarker>
          ))
        )}
        {live
          .filter((b) => shown.some((r) => r.bus.id === b.busId))
          .map((b) => (
            <Marker key={`bus-${b.busId}`} position={[b.lat, b.lng]} icon={busIcon(String(b.busId))}>
              <Tooltip>{b.line}</Tooltip>
            </Marker>
          ))}
        {pin ? <Marker position={pin} icon={pinIcon} /> : null}
      </MapContainer>
    </div>
  );
}
