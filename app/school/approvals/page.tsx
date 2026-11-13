"use client";
// S4 approvals inbox: parents' requests (new rider / stop change) wait here until the school approves or rejects.
import Link from "next/link";
import { usePoll, post } from "@/components/usePoll";
import { useToast } from "@/components/school/Toast";
import type { RequestRow } from "@/lib/types";

export default function ApprovalsPage() {
  const { data, error, refresh } = usePoll<{ requests: RequestRow[] }>("/api/requests", 3000);
  const { toast, show } = useToast(3000);

  async function decide(id: number, decision: "approve" | "reject") {
    try {
      await post(`/api/requests/${id}`, { decision });
      refresh();
    } catch (e: any) {
      show(e.message, "err");
    }
  }

  if (!data) {
    return <main style={{ padding: 16 }}>{error ? <div className="alert">{error}</div> : <div className="mut">Loading requests…</div>}</main>;
  }

  const pending = data.requests.filter((r) => r.status === "pending");
  const done = data.requests.filter((r) => r.status !== "pending");

  return (
    <main style={{ maxWidth: 620, margin: "0 auto", padding: 14 }}>
      <Link href="/school" className="mut" style={{ fontSize: 13 }}>← Transport desk</Link>
      <div style={{ fontWeight: 600, fontSize: 17, margin: "6px 0" }}>Approvals ({pending.length})</div>
      <div className="mut" style={{ fontSize: 13 }}>Approved changes appear on the attendant list from their date.</div>
      {error && <div className="alert" style={{ fontSize: 13 }}>{error}</div>}

      {pending.length === 0 && <div className="card mut" style={{ marginTop: 12 }}>No requests waiting.</div>}
      {pending.map((r) => (
        <div key={r.id} className="card" style={{ marginTop: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
            <div style={{ fontWeight: 600 }}>{r.childName} <span className="mut" style={{ fontWeight: 400 }}>· {r.classSection}</span></div>
            <span className={`chip ${r.type === "new_rider" ? "c-blue" : "c-amber"}`}>{r.type === "new_rider" ? "New rider" : "Stop change"}</span>
          </div>
          <div style={{ fontSize: 13, marginTop: 6 }}>
            {r.fromStopName ? `${r.fromStopName} → ` : "New stop: "}
            <b>{r.toStopName}</b> · {r.toBusName}
          </div>
          <div className="mut" style={{ fontSize: 12, marginTop: 2 }}>From {r.effectiveDate} · requested {r.createdText}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button className="pri" style={{ flex: 1, minHeight: 48 }} onClick={() => decide(r.id, "approve")}>Approve</button>
            <button style={{ flex: 1, minHeight: 48 }} onClick={() => decide(r.id, "reject")}>Reject</button>
          </div>
        </div>
      ))}

      {done.length > 0 && (
        <>
          <div style={{ fontWeight: 600, fontSize: 14, marginTop: 18 }}>Done</div>
          {done.map((r) => (
            <div key={r.id} className="card" style={{ marginTop: 8, display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <div style={{ fontSize: 13 }}>
                <b>{r.childName}</b> · {r.type === "new_rider" ? "New rider" : "Stop change"} → {r.toStopName} ({r.toBusName})
              </div>
              <span className={`chip ${r.status === "approved" ? "c-green" : "c-red"}`}>{r.status === "approved" ? "Approved" : "Rejected"}</span>
            </div>
          ))}
        </>
      )}
      {toast}
    </main>
  );
}
