"use client";
// Presenter panel: pick a scenario, start the simulated trip on every bus, pause or reset it.
// Only for the demo; real schools would never have this page.
import { useState } from "react";
import Link from "next/link";
import { usePoll, post } from "@/components/usePoll";
import { useToast } from "@/components/school/Toast";
import type { World, Scenario, TripKind } from "@/lib/types";

const SCENARIOS: { v: Scenario; label: string }[] = [
  { v: "normal", label: "Normal day" },
  { v: "missed", label: "Missed the bus (morning)" },
  { v: "wrong", label: "Wrong stop (afternoon)" },
  { v: "left", label: "Left on bus (Noida case)" },
];

export default function AdminDemoPage() {
  const { data: world, error, refresh } = usePoll<World>("/api/state");
  const { toast, show } = useToast(3000);
  const [scenario, setScenario] = useState<Scenario>("normal");
  const [kind, setKind] = useState<TripKind>("morning");
  const [speed, setSpeed] = useState(2);
  const [target, setTarget] = useState(1); // Aarav = id 1
  const [busy, setBusy] = useState(false);

  // "missed" only makes sense in the morning, "wrong" only in the afternoon.
  const forcedKind: TripKind | null = scenario === "missed" ? "morning" : scenario === "wrong" ? "afternoon" : null;
  const shownKind = forcedKind ?? kind;

  async function run(fn: () => Promise<unknown>, okMsg: string) {
    setBusy(true);
    try {
      await fn();
      show(okMsg);
      refresh();
    } catch (e: any) {
      show(e.message, "err");
    } finally {
      setBusy(false);
    }
  }

  const anyPaused = !!world?.buses.some((b) => b.trip?.status === "paused");
  const links = [
    ["Attendant · Bus 4", "/bus/4"], ["School desk", "/school"], ["Approvals", "/school/approvals"], ["Routes", "/school/routes"],
    ["Teacher 3-B", "/teacher/3-B"], ["Join as parent", "/join"], ["QR sheet", "/admin/qr"],
  ];

  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: 14, paddingBottom: 90 }}>
      <div style={{ fontWeight: 600, fontSize: 17 }}>Demo control</div>
      <div className="mut" style={{ fontSize: 13 }}>Presenter panel. Starting a trip restarts every bus.</div>

      <div className="card" style={{ marginTop: 12, display: "grid", gap: 12 }}>
        <label style={{ fontSize: 13 }}>
          Scenario
          <select value={scenario} onChange={(e) => setScenario(e.target.value as Scenario)} style={{ width: "100%", minHeight: 48, marginTop: 4 }}>
            {SCENARIOS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
          </select>
        </label>

        <label style={{ fontSize: 13 }}>
          Trip
          <select value={shownKind} disabled={!!forcedKind} onChange={(e) => setKind(e.target.value as TripKind)} style={{ width: "100%", minHeight: 48, marginTop: 4 }}>
            <option value="morning">Morning: home → school</option>
            <option value="afternoon">Afternoon: school → home</option>
          </select>
        </label>

        <div style={{ fontSize: 13 }}>
          Speed
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            {[1, 2, 4].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                style={{ flex: 1, minHeight: 48, ...(speed === s ? { background: "var(--tealL)", borderColor: "var(--teal)", fontWeight: 600 } : {}) }}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>

        <label style={{ fontSize: 13 }}>
          Scenario target child
          <select value={target} onChange={(e) => setTarget(Number(e.target.value))} style={{ width: "100%", minHeight: 48, marginTop: 4 }}>
            {(world?.children ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.classSection}){c.claimed ? " · judge" : ""}</option>
            ))}
          </select>
        </label>

        <button
          className="pri"
          style={{ minHeight: 56, fontSize: 16 }}
          disabled={busy}
          onClick={() => run(() => post("/api/admin/start", { scenario, kind: shownKind, speed, targetChildId: target }), "Trip started")}
        >
          Start
        </button>

        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ flex: 1, minHeight: 48 }} disabled={busy} onClick={() => run(() => post("/api/admin/pause"), anyPaused ? "Resumed" : "Paused")}>
            {anyPaused ? "Resume" : "Pause"}
          </button>
          <button style={{ flex: 1, minHeight: 48 }} disabled={busy} onClick={() => run(() => post("/api/admin/reset", {}), "Reset done")}>
            Reset
          </button>
        </div>
        <button
          style={{ minHeight: 48, fontSize: 12 }}
          disabled={busy}
          onClick={() => {
            if (window.confirm("Full reset rebuilds all data from the seed and forgets every judge's child. Continue?"))
              run(() => post("/api/admin/reset", { full: true }), "Full reset done");
          }}
        >
          Full reset (re-seed)
        </button>
      </div>

      {/* Live status per bus */}
      <div style={{ fontWeight: 600, fontSize: 14, marginTop: 16 }}>Live status</div>
      {error && <div className="alert" style={{ fontSize: 13 }}>{error}</div>}
      {!world && !error && <div className="mut" style={{ fontSize: 13 }}>Loading…</div>}
      {world?.buses.map((b) => {
        const open = world.alerts.filter((a) => a.busId === b.busId && !a.resolved).length;
        return (
          <div key={b.busId} className="card" style={{ marginTop: 8, padding: 12, fontSize: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <b>{b.busName}</b>
              <span className={`chip ${b.trip?.status === "blocked" ? "c-red" : b.trip?.status === "running" ? "c-green" : "c-gray"}`}>
                {b.trip ? b.trip.status : "no trip"}
              </span>
            </div>
            <div className="mut" style={{ marginTop: 4 }}>
              {b.trip ? `${b.trip.simClockText} · ` : ""}{b.live.line} · alerts open: {open}
            </div>
          </div>
        );
      })}

      <div style={{ fontWeight: 600, fontSize: 14, marginTop: 16 }}>Quick links</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
        {links.map(([label, href]) => (
          <Link key={href} href={href}><button style={{ minHeight: 48 }}>{label}</button></Link>
        ))}
      </div>
      {toast}
    </main>
  );
}
