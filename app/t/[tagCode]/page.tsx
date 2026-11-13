"use client";
// /t/<tagCode> : where a bag-tag QR code lands. Three faces, depending on who scans:
//   (a) bus attendant  -> "Scan on / Scan off" for this child
//   (b) anyone else, tag registered   -> "Found this bag?" card (alerts the parent, never shows a phone number)
//   (c) tag not registered yet        -> "Register a new rider" form (goes to the transport desk for approval)
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { post } from "@/components/usePoll";
import Logo from "@/components/Logo";
import type { BusRoute, ChildLite } from "@/lib/types";

interface TagInfo {
  registered: boolean;
  exists: boolean;
  child: ChildLite | null;
}

const CLASSES = ["1", "2", "3", "4", "5"].flatMap((n) => ["A", "B", "C"].map((l) => `${n}-${l}`));

export default function TagPage() {
  const params = useParams<{ tagCode: string }>();
  const tagCode = decodeURIComponent(params.tagCode);

  const [info, setInfo] = useState<TagInfo | null>(null);
  const [loadError, setLoadError] = useState("");
  const [attendant, setAttendant] = useState(false);

  // Load the tag, and decide if this phone is in attendant mode.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("mode") === "attendant" || localStorage.getItem("saferide.role") === "attendant") setAttendant(true);
    fetch(`/api/tag/${encodeURIComponent(tagCode)}`, { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Could not read this tag");
        setInfo(j);
      })
      .catch((e) => setLoadError(e.message));
  }, [tagCode]);

  const goAttendant = () => {
    window.history.replaceState(null, "", `?mode=attendant`);
    setAttendant(true);
  };

  let body: React.ReactNode;
  if (loadError) body = <Message text={loadError} bad />;
  else if (!info) body = <Message text="Loading…" />;
  else if (!info.exists) body = <Message text="Unknown tag" bad />;
  else if (attendant && info.registered && info.child) body = <AttendantView child={info.child} tagCode={tagCode} />;
  else if (info.registered && info.child) body = <FoundView child={info.child} tagCode={tagCode} onAttendant={goAttendant} />;
  else body = <RegisterView tagCode={tagCode} />;

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "20px 14px 40px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <Logo size={36} />
        <div style={{ fontWeight: 700 }}>PingME SafeRide</div>
        <span className="chip c-gray" style={{ marginLeft: "auto" }}>
          {tagCode}
        </span>
      </div>
      {body}
    </main>
  );
}

function Message({ text, bad }: { text: string; bad?: boolean }) {
  return (
    <div className="card" style={{ color: bad ? "var(--red)" : undefined, fontWeight: 600 }}>
      {text}
    </div>
  );
}

// (a) Attendant: scan this child on or off the bus.
function AttendantView({ child, tagCode }: { child: ChildLite; tagCode: string }) {
  const [result, setResult] = useState("");
  const [bad, setBad] = useState(false);
  const [busy, setBusy] = useState(false);

  const scan = async (action: "on" | "off") => {
    if (child.busId === null) {
      setBad(true);
      setResult("This child has no bus.");
      return;
    }
    setBusy(true);
    try {
      const res = await post<{ childName: string; action: string }>("/api/scan", { busId: child.busId, tagCode, action });
      setBad(false);
      setResult(`${res.childName} scanned ${res.action}.`);
    } catch (err) {
      setBad(true);
      setResult((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <div className="mut" style={{ fontSize: 12 }}>
        Attendant mode
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, margin: "4px 0 2px" }}>{child.name}</div>
      <div className="mut" style={{ fontSize: 13 }}>
        Class {child.classSection} · {child.stopName ?? "no stop"}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
        <button className="pri" disabled={busy} onClick={() => scan("on")} style={{ minHeight: 64, fontSize: 17, fontWeight: 600 }}>
          Scan on
        </button>
        <button disabled={busy} onClick={() => scan("off")} style={{ minHeight: 64, fontSize: 17, fontWeight: 600 }}>
          Scan off
        </button>
      </div>
      {result && <div style={{ marginTop: 12, fontWeight: 600, color: bad ? "var(--red)" : "var(--green)" }}>{result}</div>}
    </div>
  );
}

// (b) Someone found a bag. First name only, no phone number, ever.
function FoundView({ child, tagCode, onAttendant }: { child: ChildLite; tagCode: string; onAttendant: () => void }) {
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const firstName = child.name.split(" ")[0];

  const alertParent = async () => {
    setBusy(true);
    setError("");
    try {
      await post(`/api/tag/${encodeURIComponent(tagCode)}/found`, { message: message.trim() || undefined });
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="card">
        <div style={{ fontSize: 22, fontWeight: 700 }}>Found this bag?</div>
        <p style={{ margin: "8px 0 0" }}>
          This bag belongs to <b>{firstName}</b>.
        </p>
        {sent ? (
          <div className="alert ok" style={{ marginTop: 12, fontWeight: 600 }}>
            Parent alerted. Their number stays private.
          </div>
        ) : (
          <>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Optional message, e.g. where you found it"
              rows={3}
              style={{ width: "100%", marginTop: 12, border: "1px solid var(--line)", borderRadius: 10, padding: 10, font: "inherit", fontSize: 14 }}
            />
            <button className="pri" disabled={busy} onClick={alertParent} style={{ width: "100%", minHeight: 56, marginTop: 10, fontSize: 16, fontWeight: 600 }}>
              Alert the parent
            </button>
          </>
        )}
        {error && <div style={{ color: "var(--red)", marginTop: 8, fontSize: 13 }}>{error}</div>}
      </div>
      <div style={{ textAlign: "center", marginTop: 14 }}>
        <button onClick={onAttendant} style={{ border: "none", background: "none", color: "var(--mut)", textDecoration: "underline", fontSize: 13, minHeight: 48 }}>
          I&apos;m the bus attendant
        </button>
      </div>
    </>
  );
}

// (c) New tag: register a new rider. Needs approval from the transport desk.
function RegisterView({ tagCode }: { tagCode: string }) {
  const [routes, setRoutes] = useState<BusRoute[]>([]);
  const [name, setName] = useState("");
  const [classSection, setClassSection] = useState("1-A");
  const [parentName, setParentName] = useState("");
  const [stopId, setStopId] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/routes", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setRoutes(j.buses || []))
      .catch(() => {});
  }, []);

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await post("/api/requests", { type: "new_rider", tagCode, name: name.trim(), classSection, stopId: Number(stopId), parentName: parentName.trim() });
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (sent)
    return (
      <div className="alert ok" style={{ fontWeight: 600 }}>
        Sent to the transport desk for approval
      </div>
    );

  const field: React.CSSProperties = { display: "block", width: "100%", minHeight: 48, marginTop: 4 };
  const ready = name.trim() && parentName.trim() && stopId;

  return (
    <div className="card">
      <div style={{ fontSize: 20, fontWeight: 700 }}>Register a new rider</div>
      <p className="mut" style={{ fontSize: 13, margin: "4px 0 10px" }}>
        This tag is not linked to a child yet.
      </p>
      <label style={{ fontSize: 13 }}>
        Child name
        <input value={name} onChange={(e) => setName(e.target.value)} style={field} />
      </label>
      <label style={{ fontSize: 13, display: "block", marginTop: 10 }}>
        Class
        <select value={classSection} onChange={(e) => setClassSection(e.target.value)} style={field}>
          {CLASSES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <label style={{ fontSize: 13, display: "block", marginTop: 10 }}>
        Parent name
        <input value={parentName} onChange={(e) => setParentName(e.target.value)} style={field} />
      </label>
      <label style={{ fontSize: 13, display: "block", marginTop: 10 }}>
        Pick-up stop
        <select value={stopId} onChange={(e) => setStopId(e.target.value)} style={field}>
          <option value="">Choose a stop…</option>
          {routes.map((r) => (
            <optgroup key={r.bus.id} label={`${r.bus.name} (${r.bus.capacity - r.bus.seatsUsed} seats free)`}>
              {r.stops
                .filter((s) => !s.isSchool)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>
      <button className="pri" disabled={!ready || busy} onClick={submit} style={{ width: "100%", minHeight: 56, marginTop: 14, fontSize: 16, fontWeight: 600 }}>
        Send for approval
      </button>
      {error && <div style={{ color: "var(--red)", marginTop: 8, fontSize: 13 }}>{error}</div>}
    </div>
  );
}
