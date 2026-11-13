"use client";
// School transport desk (S1, S2, S3, S6): KPIs, live map, alerts, attendance check and live log.
// Everything comes from GET /api/state (polled every 1.5 s) plus the static map data from /api/routes.
import Link from "next/link";
import { usePoll, post } from "@/components/usePoll";
import BusMap from "@/components/BusMap";
import { useRoutes } from "@/components/school/useRoutes";
import { useToast } from "@/components/school/Toast";
import type { World } from "@/lib/types";

// Colour of the attendance chip, decided from its text (same rules as the demo).
function attClass(v: string) {
  if (/NOT|Wrong|Missed/.test(v)) return "c-red";
  if (/In class|✓|informed|dropping|Home stop|Handed/.test(v)) return "c-green";
  if (v === "On bus") return "c-blue";
  return "c-gray";
}

export default function SchoolPage() {
  const { data: world, error, refresh } = usePoll<World>("/api/state");
  const { routes } = useRoutes(world?.routesVersion);
  const { toast, show } = useToast(3000);

  async function resolve(alertId: number, resolution: string) {
    try {
      await post("/api/alerts/resolve", { alertId, resolution });
      refresh();
    } catch (e: any) {
      show(e.message, "err");
    }
  }

  if (!world) {
    return <main style={{ padding: 16 }}>{error ? <div className="alert">{error}</div> : <div className="mut">Loading transport desk…</div>}</main>;
  }

  const onboard = world.buses.reduce((n, b) => n + b.live.onBoard, 0);
  const allRiders = world.buses.flatMap((b) => b.riders);
  // "Accounted for" = children who are off the bus (dropped) or known to have missed it.
  const accounted = allRiders.filter((r) => r.state === "dropped" || r.state === "missed").length;
  const openAlerts = world.alerts.filter((a) => !a.resolved).length;
  const anyTrip = world.buses.find((b) => b.trip);
  const isMorning = (anyTrip?.trip?.kind ?? "morning") === "morning";
  const clock = anyTrip?.trip?.simClockText ?? "";

  // Children whose attendance is a problem or still in progress (not "—", "In class", "Home stop ✓", "Handed to school").
  const calm = (v: string) => v === "—" || /In class|Home stop|Handed/.test(v);
  const attention = world.buses.flatMap((b) => b.riders.filter((r) => !calm(r.attendance)).map((r) => ({ busName: b.busName, r })));

  // One line of the live log.
  const logLine = (l: (typeof world.log)[number]) => (
    <div key={l.id} style={{ padding: "2px 0" }}>
      <span className="mut">{l.simTimeText}</span>{" "}
      <span style={{ color: l.kind === "alert" ? "#A32D2D" : l.kind === "ok" ? "#3B6D11" : "inherit" }}>{l.text}</span>
    </div>
  );

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 14 }}>
      {error && <div className="alert" style={{ marginTop: 0, marginBottom: 8, fontSize: 13 }}>{error}</div>}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 17 }}>Transport desk · PEC School</div>
        <span className="mut" style={{ fontSize: 13 }}>{clock}</span>
      </div>
      {/* Approvals + Routes in one tidy row under the title */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, margin: "8px 0 10px" }}>
        <Link href="/school/approvals">
          <button style={{ minHeight: 48, width: "100%" }}>Approvals ({world.pendingRequests})</button>
        </Link>
        <Link href="/school/routes">
          <button style={{ minHeight: 48, width: "100%" }}>Routes</button>
        </Link>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        <div className="kpi"><div className="k">On board</div><div className="v">{onboard}</div></div>
        <div className="kpi"><div className="k">Accounted for</div><div className="v">{accounted}/{allRiders.length}</div></div>
        <div className="kpi" style={openAlerts ? { background: "#FCEBEB" } : undefined}>
          <div className="k">Open alerts</div>
          <div className="v" style={openAlerts ? { color: "#A32D2D" } : undefined}>{openAlerts}</div>
        </div>
      </div>

      {/* Two columns on a laptop (>= 900px), one column on a phone. See the style tag below. */}
      <div className="school-grid" style={{ marginTop: 12 }}>
        <div>
          <BusMap routes={routes} live={world.buses.map((b) => b.live)} height={260} />

          <div style={{ fontWeight: 600, fontSize: 14, marginTop: 14 }}>Alerts</div>
          {world.alerts.length === 0 && <div className="mut" style={{ fontSize: 13, marginTop: 6 }}>No alerts. Every child is where they should be.</div>}
          {world.alerts.map((a) => (
            <div key={a.id} className={`alert ${a.resolved ? "ok" : ""}`}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{a.title}</span>
                <span className={`chip ${a.resolved ? "c-green" : "c-red"}`}>{a.resolved ? "Resolved" : a.levelName}</span>
              </div>
              <div style={{ fontSize: 12, marginTop: 3 }}>{a.detail}</div>
              {a.resolved && a.resolution && <div className="mut" style={{ fontSize: 12, marginTop: 3 }}>{a.resolution}</div>}
              {!a.resolved && a.type === "wrong_stop" && (
                <button style={{ marginTop: 6, minHeight: 48 }} onClick={() => resolve(a.id, "Child confirmed safe")}>
                  Child confirmed safe
                </button>
              )}
              {!a.resolved && a.type === "missed" && (
                <button style={{ marginTop: 6, minHeight: 48 }} onClick={() => resolve(a.id, "Absent, parent informed")}>
                  Mark parent informed
                </button>
              )}
            </div>
          ))}
        </div>

        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            {isMorning ? "Attendance check · bus scans vs class register" : "Drop-off check"}
          </div>
          {/* Default view: only children who need a look. The full table is one tap away. */}
          <div style={{ fontWeight: 600, fontSize: 13, marginTop: 8 }}>Needs attention ({attention.length})</div>
          {attention.length === 0 ? (
            <div className="mut" style={{ fontSize: 13, marginTop: 6 }}>All children accounted for ✓</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <tbody>
                {attention.map(({ busName, r }) => (
                  <tr key={r.childId} style={{ borderBottom: "1px solid var(--line)" }}>
                    <td style={{ padding: "8px 0" }}>{r.name} <span className="mut" style={{ fontSize: 12 }}>{busName}</span></td>
                    <td className="mut" style={{ padding: "8px 6px" }}>{r.classSection}</td>
                    <td style={{ textAlign: "right" }}><span className={`chip ${attClass(r.attendance)}`}>{r.attendance}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <details style={{ marginTop: 10 }}>
            <summary style={{ minHeight: 48, display: "flex", alignItems: "center", cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
              Show all children ({allRiders.length})
            </summary>
            {world.buses.map((b) => (
              <div key={b.busId} style={{ marginTop: 8 }}>
                <div className="mut" style={{ fontSize: 12, fontWeight: 600 }}>{b.busName}</div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <tbody>
                    {b.riders.map((r) => (
                      <tr key={r.childId} style={{ borderBottom: "1px solid var(--line)" }}>
                        <td style={{ padding: "8px 0" }}>{r.name}</td>
                        <td className="mut" style={{ padding: "8px 6px" }}>{r.classSection}</td>
                        <td style={{ textAlign: "right" }}><span className={`chip ${attClass(r.attendance)}`}>{r.attendance}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </details>

          <div style={{ fontWeight: 600, fontSize: 14, marginTop: 14 }}>Live log</div>
          {/* Newest 6 lines only; the rest sits behind "Show full log" */}
          <div style={{ fontSize: 12, marginTop: 4 }}>
            {world.log.length === 0 && <div className="mut">Nothing yet.</div>}
            {world.log.slice(0, 6).map(logLine)}
          </div>
          {world.log.length > 6 && (
            <details>
              <summary style={{ minHeight: 48, display: "flex", alignItems: "center", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Show full log</summary>
              <div style={{ fontSize: 12, maxHeight: 260, overflowY: "auto" }}>{world.log.slice(6).map(logLine)}</div>
            </details>
          )}
        </div>
      </div>

      <style>{`.school-grid{display:grid;grid-template-columns:1fr;gap:16px}@media(min-width:900px){.school-grid{grid-template-columns:1fr 1fr}}`}</style>
      {toast}
    </main>
  );
}
