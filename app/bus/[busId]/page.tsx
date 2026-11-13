"use client";
// Attendant screen (A1-A4): the person on the bus scans each child's bag tag on and off.
// Polls /api/state every 1.5 s and shows only THIS bus. Hindi / English toggle is saved in localStorage.
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { usePoll, post } from "@/components/usePoll";
import QrScanner from "@/components/school/QrScanner";
import { useToast } from "@/components/school/Toast";
import type { World, Rider } from "@/lib/types";

type Lang = "en" | "hi";

// Small dictionary: only the buttons, chips and headings on this page.
const T = {
  en: {
    morning: "Morning", afternoon: "Afternoon", onBoard: "on board", auto: "Auto-scan",
    scan: "Scan bag tag", closeCam: "Close camera", scanOn: "Scan on", scanOff: "Scan off",
    waiting: "Waiting", atschool: "At school", onboard: "On board", off: "Off", missed: "Missed",
    end: "End trip", closed: "Trip closed ✓", blocked: "Trip blocked: check every seat",
    blockedSub: "These children were scanned on but never off.", found: "Found · scan off",
    none: "No trip running. Start one from Admin.", loading: "Loading…", scanned: "scanned", on: "ON", offw: "OFF",
    noRiders: "No children on this bus.",
  },
  hi: {
    morning: "सुबह", afternoon: "दोपहर", onBoard: "बस में", auto: "ऑटो-स्कैन",
    scan: "बैग टैग स्कैन करें", closeCam: "कैमरा बंद करें", scanOn: "चढ़ा", scanOff: "उतरा",
    waiting: "इंतज़ार", atschool: "स्कूल में", onboard: "बस में", off: "उतरा", missed: "छूट गया",
    end: "यात्रा खत्म करें", closed: "यात्रा बंद ✓", blocked: "यात्रा रुकी: हर सीट देखें",
    blockedSub: "ये बच्चे चढ़े थे पर उतरे नहीं।", found: "मिल गया · उतारें",
    none: "कोई यात्रा नहीं चल रही। एडमिन से शुरू करें।", loading: "लोड हो रहा है…", scanned: "स्कैन", on: "चढ़ा", offw: "उतरा",
    noRiders: "इस बस में कोई बच्चा नहीं।",
  },
};

const initials = (name: string) => name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

export default function AttendantPage() {
  const params = useParams<{ busId: string }>();
  const busId = Number(params.busId);

  const { data: world, error, refresh } = usePoll<World>("/api/state");
  const { toast, show } = useToast(2000);
  const [lang, setLang] = useState<Lang>("en");
  const [camera, setCamera] = useState(false);
  const lastScan = useRef<{ code: string; at: number }>({ code: "", at: 0 }); // for the 3 s debounce
  const t = T[lang];

  // Remember the language between visits.
  useEffect(() => {
    const saved = localStorage.getItem("saferide.lang");
    if (saved === "hi" || saved === "en") setLang(saved);
  }, []);
  function toggleLang() {
    const next: Lang = lang === "en" ? "hi" : "en";
    setLang(next);
    localStorage.setItem("saferide.lang", next);
  }

  const bus = world?.buses.find((b) => b.busId === busId);
  const trip = bus?.trip ?? null;
  const canScan = !!trip && trip.status !== "closed";
  const blocked = trip?.status === "blocked";

  // Run a request and show errors in a red toast.
  async function run(fn: () => Promise<unknown>) {
    try {
      await fn();
      refresh();
    } catch (e: any) {
      show(e.message, "err");
    }
  }

  // Called by the camera for every QR it sees.
  async function onCode(text: string) {
    const m = text.match(/PM-BAG-\d+/);
    if (!m) return;
    const code = m[0];
    const now = Date.now();
    if (lastScan.current.code === code && now - lastScan.current.at < 3000) return; // same tag within 3 s: ignore
    lastScan.current = { code, at: now };
    try {
      const r = await post<{ childName: string; action: "on" | "off" }>("/api/scan", { busId, tagCode: code });
      show(`${r.childName} ${t.scanned} ${r.action === "on" ? t.on : t.offw}`);
      refresh();
    } catch (e: any) {
      show(e.message, "err");
    }
  }

  function statusChip(r: Rider) {
    switch (r.state) {
      case "waiting": return <span className="chip c-gray">{t.waiting}</span>;
      case "atschool": return <span className="chip c-gray">{t.atschool}</span>;
      case "onboard": return <span className="chip c-blue">{t.onboard}</span>;
      case "dropped": return <span className="chip c-green">{t.off} · {(r.dropStopName || "").replace("PEC ", "")}</span>;
      case "missed": return <span className="chip c-red">{t.missed}</span>;
    }
  }

  if (!world) {
    return <main style={{ padding: 16 }}>{error ? <div className="alert">{error}</div> : <div className="mut">{t.loading}</div>}</main>;
  }
  if (!bus) {
    return <main style={{ padding: 16 }}><div className="card">Bus {busId}: not found.</div></main>;
  }

  const onboardRiders = bus.riders.filter((r) => r.state === "onboard");

  return (
    <main style={{ maxWidth: 520, margin: "0 auto", padding: 14, paddingBottom: 90 }}>
      {error && <div className="alert" style={{ marginTop: 0, marginBottom: 8, fontSize: 13 }}>{error}</div>}

      {/* Header: bus name, where the bus is, how many on board */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 17 }}>
            {bus.busName}{trip ? ` · ${trip.kind === "morning" ? t.morning : t.afternoon}` : ""}
          </div>
          <div className="mut" style={{ fontSize: 13 }}>{bus.live.line} · {bus.live.onBoard} {t.onBoard}</div>
        </div>
        <button onClick={toggleLang} className="chip c-teal" style={{ minHeight: 48, minWidth: 64, fontSize: 14 }} aria-label="Language">
          हिं / EN
        </button>
      </div>

      {!trip ? (
        <div className="card mut" style={{ marginTop: 12, textAlign: "center" }}>{t.none}</div>
      ) : (
        <>
          <label style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 48, fontSize: 14 }}>
            <input
              type="checkbox"
              style={{ width: 22, height: 22 }}
              checked={trip.autoScan}
              onChange={(e) => run(() => post("/api/trip/autoscan", { busId, on: e.target.checked }))}
            />
            {t.auto}
          </label>

          {/* Blocked: end trip was pressed but children are still on board. Shown at the TOP so it can't be missed. */}
          {blocked && (
            <div className="check" style={{ marginTop: 0, marginBottom: 12 }}>
              <div style={{ fontWeight: 600, color: "#791F1F" }}>{t.blocked}</div>
              <div style={{ fontSize: 12, color: "#791F1F", margin: "4px 0 8px" }}>{t.blockedSub}</div>
              {onboardRiders.map((r) => (
                <div key={r.childId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, gap: 8 }}>
                  <span className="blink" style={{ fontWeight: 600 }}>{r.name}</span>
                  <button className="danger" style={{ minHeight: 48 }} onClick={() => run(() => post("/api/trip/found", { busId, childId: r.childId }))}>
                    {t.found}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* The one primary button on this screen */}
          <button className="pri" style={{ width: "100%", minHeight: 56, fontSize: 16 }} disabled={!canScan} onClick={() => setCamera((c) => !c)}>
            {t.scan}
          </button>
          {camera && canScan && <QrScanner onCode={onCode} onClose={() => setCamera(false)} closeLabel={t.closeCam} />}

          {/* Child list */}
          <div style={{ marginTop: 8 }}>
            {bus.riders.length === 0 && <div className="mut" style={{ fontSize: 13 }}>{t.noRiders}</div>}
            {bus.riders.map((r) => {
              const canOn = r.state === "waiting" || r.state === "atschool" || r.state === "missed";
              const canOff = r.state === "onboard" && !blocked;
              return (
                <div key={r.childId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                  <div className="av">{initials(r.name)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Long names are cut with "…" so the row never wraps on a 375 px phone */}
                    <div style={{ fontSize: 14, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
                    <div className="mut" style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.classSection} · {r.stopName}</div>
                  </div>
                  <div style={{ flex: "none", whiteSpace: "nowrap" }}>{statusChip(r)}</div>
                  {(canOn || canOff) && (
                    <button
                      style={{ minHeight: 48, minWidth: 72 }}
                      disabled={!canScan || blocked}
                      onClick={() => run(() => post("/api/scan", { busId, childId: r.childId, action: canOn ? "on" : "off" }))}
                    >
                      {canOn ? t.scanOn : t.scanOff}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* End trip (the red "check every seat" box replaces it at the top when blocked) */}
          {!blocked && (
            <button
              style={{ width: "100%", marginTop: 12, minHeight: 48 }}
              disabled={!bus.canEndTrip}
              onClick={() => run(() => post("/api/trip/end", { busId }))}
            >
              {trip.status === "closed" ? t.closed : t.end}
            </button>
          )}
        </>
      )}
      {toast}
    </main>
  );
}
