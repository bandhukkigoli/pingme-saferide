"use client";
// S7 teacher view: only the children of ONE class, so a teacher can see who is on the bus,
// who reached class, and who is missing. Class comes from the URL, e.g. /teacher/3-B.
import { useParams, useRouter } from "next/navigation";
import { usePoll } from "@/components/usePoll";
import type { World } from "@/lib/types";

// The class list for the selector: 1-A ... 5-C
const CLASSES = [1, 2, 3, 4, 5].flatMap((n) => ["A", "B", "C"].map((s) => `${n}-${s}`));

export default function TeacherPage() {
  const params = useParams<{ class: string }>();
  const router = useRouter();
  const cls = decodeURIComponent(params.class);
  const { data: world, error } = usePoll<World>("/api/state");

  if (!world) {
    return <main style={{ padding: 16 }}>{error ? <div className="alert">{error}</div> : <div className="mut">Loading class…</div>}</main>;
  }

  // Every rider of every bus, with the bus name attached, filtered to this class.
  const rows = world.buses.flatMap((b) => b.riders.filter((r) => r.classSection === cls).map((r) => ({ ...r, busName: b.busName })));
  const childIds = new Set(world.children.filter((c) => c.classSection === cls).map((c) => c.id));
  const alerts = world.alerts.filter((a) => childIds.has(a.childId));

  // Turn a rider into the teacher's wording + chip colour.
  function status(state: string, attendance: string): [string, string] {
    if (/NOT in class/.test(attendance)) return ["Unaccounted", "c-red"];
    if (state === "missed") return ["Missed bus", "c-red"];
    if (state === "onboard") return ["On bus", "c-blue"];
    if (/In class/.test(attendance) || (state === "dropped" && /school/i.test(attendance))) return ["In class", "c-green"];
    return [attendance, "c-gray"];
  }

  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 17 }}>Class {cls}</div>
        <select value={CLASSES.includes(cls) ? cls : ""} onChange={(e) => router.push(`/teacher/${encodeURIComponent(e.target.value)}`)} style={{ minHeight: 48 }} aria-label="Choose class">
          {!CLASSES.includes(cls) && <option value="">{cls}</option>}
          {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      {error && <div className="alert" style={{ fontSize: 13 }}>{error}</div>}

      <div className="card" style={{ marginTop: 12 }}>
        {rows.length === 0 && <div className="mut" style={{ fontSize: 13 }}>No bus riders in this class.</div>}
        {rows.map((r) => {
          const [label, color] = status(r.state, r.attendance);
          return (
            <div key={r.childId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--line)", minHeight: 48 }}>
              <div style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{r.name}</div>
              <span className="mut" style={{ fontSize: 12 }}>{r.busName}</span>
              <span className={`chip ${color}`}>{label}</span>
            </div>
          );
        })}
      </div>

      <div style={{ fontWeight: 600, fontSize: 14, marginTop: 14 }}>Mismatch alerts</div>
      {alerts.length === 0 && <div className="mut" style={{ fontSize: 13, marginTop: 6 }}>No alerts for this class.</div>}
      {alerts.map((a) => (
        <div key={a.id} className={`alert ${a.resolved ? "ok" : ""}`}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>{a.title}</span>
            <span className={`chip ${a.resolved ? "c-green" : "c-red"}`}>{a.resolved ? "Resolved" : a.levelName}</span>
          </div>
          <div style={{ fontSize: 12, marginTop: 3 }}>{a.detail}</div>
        </div>
      ))}
    </main>
  );
}
