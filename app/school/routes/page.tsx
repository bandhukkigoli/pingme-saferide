"use client";
// S5 route editor: the school sets the ORDER of stops for each bus (no automatic route planning).
// Move up/down, rename, delete, or tap the map to add a new stop. The server re-draws the road after each change.
import { useState } from "react";
import Link from "next/link";
import { usePoll, post } from "@/components/usePoll";
import BusMap from "@/components/BusMap";
import { useRoutes } from "@/components/school/useRoutes";
import { useToast } from "@/components/school/Toast";
import type { World } from "@/lib/types";

export default function RoutesPage() {
  // We only need the World to know when the routes changed (routesVersion).
  const { data: world, error } = usePoll<World>("/api/state", 2000);
  const { routes } = useRoutes(world?.routesVersion);
  const { toast, show } = useToast(3000);

  const [busId, setBusId] = useState<number | null>(null);
  const [editing, setEditing] = useState<number | null>(null); // stop id being renamed
  const [editName, setEditName] = useState("");
  const [pin, setPin] = useState<[number, number] | null>(null);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  // Run one edit; show server errors in a red toast.
  async function act(fn: () => Promise<unknown>, okMsg?: string) {
    setBusy(true);
    try {
      await fn();
      if (okMsg) show(okMsg);
    } catch (e: any) {
      show(e.message, "err");
    } finally {
      setBusy(false);
    }
  }

  if (!world || routes.length === 0) {
    return <main style={{ padding: 16 }}>{error ? <div className="alert">{error}</div> : <div className="mut">Loading routes…</div>}</main>;
  }

  const current = routes.find((r) => r.bus.id === busId) ?? routes[0];
  const stops = [...current.stops].sort((a, b) => a.seq - b.seq);

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: 14, paddingBottom: 90 }}>
      <Link href="/school" className="mut" style={{ fontSize: 13 }}>← Transport desk</Link>
      <div style={{ fontWeight: 600, fontSize: 17, margin: "6px 0" }}>Route editor</div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <select
          value={current.bus.id}
          onChange={(e) => { setBusId(Number(e.target.value)); setPin(null); setEditing(null); }}
          style={{ minHeight: 48 }}
          aria-label="Choose bus"
        >
          {routes.map((r) => <option key={r.bus.id} value={r.bus.id}>{r.bus.name}</option>)}
        </select>
        <span className="chip c-teal">Seats {current.bus.seatsUsed}/{current.bus.capacity}</span>
      </div>

      <div className="routes-grid" style={{ marginTop: 12 }}>
        <div>
          <BusMap routes={routes} onlyBusId={current.bus.id} height={300} pin={pin} onMapClick={(lat, lng) => setPin([lat, lng])} />
          <div className="mut" style={{ fontSize: 12, marginTop: 6 }}>
            Tap the map to drop a pin for a new stop.
          </div>

          {/* Add stop: needs a pin and a name */}
          <div className="card" style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Add stop</div>
            <div className="mut" style={{ fontSize: 12, margin: "2px 0 8px" }}>
              {pin ? "Pin placed. Name it, then Add." : "No pin yet: tap the map first."}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Stop name"
                style={{ flex: 1, minHeight: 48 }}
              />
              <button
                className="pri"
                style={{ minHeight: 48 }}
                disabled={busy || !pin || !newName.trim()}
                onClick={() =>
                  act(async () => {
                    await post("/api/stops", { busId: current.bus.id, name: newName.trim(), lat: pin![0], lng: pin![1] });
                    setPin(null);
                    setNewName("");
                  }, "Stop added")
                }
              >
                Add
              </button>
            </div>
          </div>
        </div>

        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Stops in order (morning pickup → school)</div>
          {stops.map((s, i) => {
            const first = i === 0;
            const last = i === stops.length - 1;
            return (
              <div key={s.id} className="card" style={{ marginTop: 8, padding: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div className="av">{i + 1}</div>
                  {editing === s.id ? (
                    <>
                      <input value={editName} onChange={(e) => setEditName(e.target.value)} style={{ flex: 1, minWidth: 0, minHeight: 48 }} />
                      <button
                        className="pri"
                        style={{ minHeight: 48 }}
                        disabled={busy || !editName.trim()}
                        onClick={() => act(async () => { await post(`/api/stops/${s.id}`, { name: editName.trim() }, "PATCH"); setEditing(null); }, "Renamed")}
                      >
                        Save
                      </button>
                    </>
                  ) : (
                    <div style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 500 }}>
                      {s.name} {s.isSchool && <span className="chip c-teal">School</span>}
                    </div>
                  )}
                </div>
                {/* The school is always last: it cannot move, be renamed away, or be deleted */}
                {!s.isSchool && editing !== s.id && (
                  <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                    <button style={{ minWidth: 48, minHeight: 48 }} disabled={busy || first} aria-label="Move up" onClick={() => act(() => post(`/api/stops/${s.id}/move`, { dir: "up" }))}>↑</button>
                    <button style={{ minWidth: 48, minHeight: 48 }} disabled={busy || last || stops[i + 1]?.isSchool} aria-label="Move down" onClick={() => act(() => post(`/api/stops/${s.id}/move`, { dir: "down" }))}>↓</button>
                    <button style={{ minHeight: 48 }} onClick={() => { setEditing(s.id); setEditName(s.name); }}>Rename</button>
                    <button
                      style={{ minHeight: 48 }}
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(`Delete stop "${s.name}"?`)) act(() => post(`/api/stops/${s.id}`, {}, "DELETE"), "Stop deleted");
                      }}
                    >
                      Delete
                    </button>
                  </div>
                )}
                {editing === s.id && (
                  <button style={{ marginTop: 8, minHeight: 48 }} onClick={() => setEditing(null)}>Cancel</button>
                )}
              </div>
            );
          })}
          <div className="mut" style={{ fontSize: 12, marginTop: 12 }}>
            No automatic route planning: you set the order; the road between stops comes from OpenStreetMap.
          </div>
        </div>
      </div>

      <style>{`.routes-grid{display:grid;grid-template-columns:1fr;gap:16px}@media(min-width:900px){.routes-grid{grid-template-columns:1fr 1fr}}`}</style>
      {toast}
    </main>
  );
}
