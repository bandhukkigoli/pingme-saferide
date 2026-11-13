// Run once: `npm run routes`
// Reads the stops from db/seed.sql, asks OSRM for the real road through them,
// and saves the result to db/routes.json so "Reset demo" never needs the internet.
import { readFileSync, writeFileSync } from "node:fs";
import { fetchRoadRoute } from "../lib/route.ts";

const seed = readFileSync("db/seed.sql", "utf8");
// Matches lines like: (1, 4, 'Sector 35', 30.72, 76.75, 0, FALSE)
const re = /\((\d+), (\d+), '([^']+)', ([\d.]+), ([\d.]+), (\d+), (TRUE|FALSE)\)/g;
const stops = [...seed.matchAll(re)].map((m) => ({ busId: +m[2], name: m[3], lat: +m[4], lng: +m[5], seq: +m[6] }));
const out = {};
for (const busId of [...new Set(stops.map((s) => s.busId))]) {
  const list = stops.filter((s) => s.busId === busId).sort((a, b) => a.seq - b.seq);
  const route = await fetchRoadRoute(list);
  out[busId] = { signature: list.map((s) => `${s.lat},${s.lng}`).join(";"), route };
  console.log(`Bus ${busId}: ${route.source}, ${Math.round(route.total)} m, ${route.coords.length} points, stops at`, route.stopDist.map(Math.round));
}
writeFileSync("db/routes.json", JSON.stringify(out));
