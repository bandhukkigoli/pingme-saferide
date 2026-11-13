"use client";
// "Change my stop": the parent taps the map to drop a pin, we show the nearest stops (with bus + free seats),
// they pick one and a start date, and we send a request to the transport desk.
// PRIVACY: the pin is only sent to /api/nearest to look up stops. It is never saved anywhere.
import { useState } from "react";
import BusMap from "@/components/BusMap";
import { post } from "@/components/usePoll";
import { t, fmtDist, type Lang } from "@/lib/i18n";
import type { BusRoute, NearestStop } from "@/lib/types";

// Today as YYYY-MM-DD in the phone's own time zone.
function todayText() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export default function StopChange({ childId, routes, lang }: { childId: number; routes: BusRoute[]; lang: Lang }) {
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState<[number, number] | null>(null);
  const [stops, setStops] = useState<NearestStop[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [date, setDate] = useState(todayText());
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Parent tapped the map: remember the pin on screen only, ask the server for nearby stops.
  const onMapClick = async (lat: number, lng: number) => {
    setPin([lat, lng]);
    setPicked(null);
    setSent(false);
    setError("");
    try {
      const res = await fetch(`/api/nearest?lat=${lat}&lng=${lng}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not find stops");
      setStops(json.stops || []);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const send = async () => {
    if (picked === null) return;
    setBusy(true);
    setError("");
    try {
      await post("/api/requests", { type: "stop_change", childId, stopId: picked, effectiveDate: date });
      setSent(true);
      setPin(null); // forget the pin
      setStops([]);
      setPicked(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{ width: "100%", minHeight: 52, marginTop: 14, fontWeight: 600 }}>
        {t(lang, "change_stop")}
      </button>
    );
  }

  return (
    <div className="card" style={{ marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <b>{t(lang, "change_stop")}</b>
        <button onClick={() => setOpen(false)} style={{ minHeight: 48, minWidth: 48 }}>
          {t(lang, "close")}
        </button>
      </div>

      {sent ? (
        <div className="alert ok" style={{ marginTop: 10, fontWeight: 600 }}>
          {t(lang, "request_sent")}
        </div>
      ) : (
        <>
          <p className="mut" style={{ fontSize: 13, margin: "8px 0" }}>
            {t(lang, "tap_map")}
          </p>
          <BusMap routes={routes} height={260} pin={pin} onMapClick={onMapClick} />
          <p className="mut" style={{ fontSize: 12, margin: "8px 0" }}>
            {t(lang, "pin_not_saved")}
          </p>

          {stops.length > 0 && (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, margin: "6px 0" }}>{t(lang, "nearest")}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {stops.map((s) => {
                  const full = s.freeSeats <= 0;
                  const on = picked === s.stop.id;
                  return (
                    <button
                      key={s.stop.id}
                      disabled={full}
                      onClick={() => setPicked(s.stop.id)}
                      style={{
                        minHeight: 56,
                        textAlign: "left",
                        borderColor: on ? "var(--teal)" : undefined,
                        background: on ? "var(--tealL)" : "#fff",
                        borderWidth: on ? 2 : 1,
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{s.stop.name}</div>
                      <div className="mut" style={{ fontSize: 12 }}>
                        {s.busName} · {fmtDist(s.distanceM)} · {full ? t(lang, "full") : t(lang, "seats_free", { n: s.freeSeats })}
                      </div>
                    </button>
                  );
                })}
              </div>

              <label style={{ display: "block", fontSize: 13, marginTop: 12 }}>
                {t(lang, "start_date")}
                <input type="date" value={date} min={todayText()} onChange={(e) => setDate(e.target.value)} style={{ display: "block", width: "100%", minHeight: 48, marginTop: 4 }} />
              </label>
              <button className="pri" disabled={picked === null || busy || !date} onClick={send} style={{ width: "100%", minHeight: 52, marginTop: 12, fontWeight: 600 }}>
                {t(lang, "send_request")}
              </button>
            </>
          )}
        </>
      )}
      {error && <div style={{ color: "var(--red)", fontSize: 13, marginTop: 8 }}>{error}</div>}
    </div>
  );
}
