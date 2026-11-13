"use client";
// The PARENT page (/p/<childId>). Phone-first. It polls /api/state?child=ID every 1.5 s and shows:
// pass card, live ETA, live map, alert distance, alarm setting, day timeline, "change my stop".
// New events pop up as a full-screen takeover (see components/parent/Takeover.tsx).
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import BusMap from "@/components/BusMap";
import { usePoll, post } from "@/components/usePoll";
import Takeover from "@/components/parent/Takeover";
import StopChange from "@/components/parent/StopChange";
import { askNotificationPermission, unlockAudio } from "@/components/parent/alarm";
import { eventText, fmtDist, t, type Lang } from "@/lib/i18n";
import type { BusRoute, World } from "@/lib/types";

// Dot colour in the timeline, per event colour.
const DOT: Record<string, string> = { blue: "#185FA5", amber: "#BA7517", green: "#3B6D11", red: "#A32D2D" };

// Status chip colour per rider state.
const CHIP: Record<string, string> = { waiting: "c-gray", atschool: "c-gray", onboard: "c-blue", dropped: "c-green", missed: "c-red" };

export default function ParentPage() {
  const params = useParams<{ childId: string }>();
  const childId = Number(params.childId);

  const [lang, setLang] = useState<Lang>("en");
  const [nearMode, setNearMode] = useState<"alarm" | "notification">("alarm");
  // Sound must be unlocked by a tap on EVERY page load (browser rule), so the banner shows until then.
  const [soundReady, setSoundReady] = useState(false);
  const [routes, setRoutes] = useState<BusRoute[]>([]);
  const [routesVersion, setRoutesVersion] = useState<number | null>(null);
  const [pickedRadius, setPickedRadius] = useState<number | null>(null); // instant feedback after a tap

  const { data: world, error } = usePoll<World>(Number.isFinite(childId) ? `/api/state?child=${childId}` : null);
  const me = world?.me ?? null;

  // Read saved settings once, remember this phone's child, register the service worker.
  useEffect(() => {
    if (localStorage.getItem("saferide.lang") === "hi") setLang("hi");
    if (localStorage.getItem("saferide.nearMode") === "notification") setNearMode("notification");
    localStorage.setItem("saferide.childId", String(childId));
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});

    // Browsers need a tap before sound: wake the audio on the very first touch anywhere.
    const wake = () => {
      unlockAudio();
      setSoundReady(true);
    };
    document.addEventListener("pointerdown", wake, { once: true });
    return () => document.removeEventListener("pointerdown", wake);
  }, [childId]);

  // Fetch the road + stops once, and again whenever the route editor bumps routesVersion.
  useEffect(() => {
    if (!world || world.routesVersion === routesVersion) return;
    setRoutesVersion(world.routesVersion);
    fetch("/api/routes", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setRoutes(j.buses || []))
      .catch(() => {});
  }, [world, routesVersion]);

  // Forget the instant radius highlight once the server confirms it.
  useEffect(() => {
    if (me && pickedRadius !== null && me.radiusM === pickedRadius) setPickedRadius(null);
  }, [me, pickedRadius]);

  const toggleLang = () => {
    const next: Lang = lang === "en" ? "hi" : "en";
    setLang(next);
    localStorage.setItem("saferide.lang", next);
  };

  const chooseNearMode = (m: "alarm" | "notification") => {
    setNearMode(m);
    localStorage.setItem("saferide.nearMode", m);
  };

  // The one-tap banner: unlock sound + ask permission for phone notifications.
  const turnOnSound = async () => {
    unlockAudio();
    await askNotificationPermission();
    localStorage.setItem("saferide.soundReady", "1");
    setSoundReady(true);
  };

  const chooseRadius = (m: number) => {
    setPickedRadius(m);
    post("/api/prefs", { childId, radiusM: m }).catch(() => setPickedRadius(null));
  };

  if (!Number.isFinite(childId)) return <main style={{ padding: 16 }}>Unknown child.</main>;
  if (!me) {
    return (
      <main style={{ padding: 16 }} className="mut">
        {error ?? t(lang, "loading")}
      </main>
    );
  }

  // ---- values for the screen ----
  const child = me.child;
  const busView = world!.buses.find((b) => b.busId === me.busId);
  const trip = busView?.trip ?? null;
  const busLabel = busView?.busName ?? (me.busId ? `Bus ${me.busId}` : "—");
  const busText = lang === "hi" ? busLabel.replace(/^Bus/i, "बस") : busLabel;
  const tripName = t(lang, trip?.kind === "afternoon" ? "trip_afternoon" : "trip_morning");
  const radius = pickedRadius ?? me.radiusM;
  const initials = child.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  // Status chip comes from the rider state ("waiting", "onboard", ...).
  const state = me.rider?.state;
  const statusText = state ? t(lang, "st_" + state) : t(lang, "st_none");
  const statusChip = state ? CHIP[state] : "c-gray";
  const arrives = me.eta ? `~${me.eta.minutes} min` : "—";

  // The always-visible ETA line.
  let etaLine: string;
  if (me.eta) etaLine = t(lang, trip?.kind === "morning" && me.rider?.state === "onboard" ? "eta_school" : "eta_line", { bus: busText, dist: fmtDist(me.eta.distM), min: me.eta.minutes });
  else if (!trip || trip.status === "idle" || trip.status === "closed") etaLine = t(lang, "eta_none", { bus: busText });
  else etaLine = t(lang, "eta_passed", { bus: busText });

  // Left-border colour of the status strip: blue on board, green safe (dropped),
  // amber when the bus is inside the alert radius, grey otherwise.
  let stripColour = "#9a9a92";
  if (state === "dropped") stripColour = DOT.green;
  else if (state === "onboard") stripColour = DOT.blue;
  else if (me.eta && me.eta.distM <= radius) stripColour = DOT.amber;

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "12px 12px 40px" }}>
      <Takeover childId={childId} events={me.events} lang={lang} nearMode={nearMode} />

      {/* One-tap banner (only when needed): browsers need a tap before they allow sound */}
      {!soundReady && (
        <div className="card" style={{ marginBottom: 8, background: "var(--amberL)", borderColor: "#EBCB92" }}>
          <div style={{ fontWeight: 600 }}>{t(lang, "sound_title")}</div>
          <div style={{ fontSize: 13, margin: "4px 0 10px" }}>{t(lang, "sound_why")}</div>
          <button className="pri" onClick={turnOnSound} style={{ width: "100%", minHeight: 52, fontWeight: 600 }}>
            {t(lang, "sound_btn")}
          </button>
        </div>
      )}

      {/* Thin top row: trip name + clock on the left, language toggle on the right */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
        <span className="mut">
          {tripName}
          {trip ? " · " : ""}
          {trip?.simClockText ?? ""}
        </span>
        <button className="chip c-teal" onClick={toggleLang} style={{ minHeight: 48, minWidth: 48, fontSize: 13, border: "none" }} aria-label="Change language">
          हिं / EN
        </button>
      </div>

      {/* Child pass card */}
      <div className="pass" style={{ marginTop: 10 }}>
        <div className="pass-top" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="av">{initials}</div>
          <div>
            <div style={{ fontWeight: 600 }}>{child.name}</div>
            <div style={{ fontSize: 12, color: "#9FE1CB" }}>
              {t(lang, "class")} {child.classSection} · {t(lang, "tag")} {child.tagCode}
            </div>
          </div>
        </div>
        <div className="pass-grid">
          <div>
            <div className="k">{t(lang, "bus")}</div>
            <div className="v">{me.busId ?? "—"}</div>
          </div>
          <div>
            <div className="k">{t(lang, "home_stop")}</div>
            <div className="v">{child.stopName ?? "—"}</div>
          </div>
          <div>
            <div className="k">{t(lang, "status")}</div>
            <div className="v">
              <span className={`chip ${statusChip}`} style={{ fontSize: 12 }}>
                {statusText}
              </span>
            </div>
          </div>
          <div>
            <div className="k">{t(lang, "arrives")}</div>
            <div className="v">{arrives}</div>
          </div>
        </div>
        <div className="pass-foot">
          {t(lang, "last_scan")}: {me.lastScanText}
        </div>
      </div>

      {/* ONE big live status strip: the ETA line, with the status colour as a left border */}
      <div className="card" style={{ marginTop: 10, fontSize: 17, fontWeight: 700, borderLeft: `6px solid ${stripColour}` }}>
        {etaLine}
      </div>

      {/* Live map */}
      <div style={{ marginTop: 10 }}>
        {routes.length > 0 ? (
          <BusMap routes={routes} live={world!.buses.map((b) => b.live)} onlyBusId={me.busId} homeStopId={child.stopId} radiusM={radius} height={220} />
        ) : (
          <div style={{ height: 220, borderRadius: 14, background: "#f1efe8" }} />
        )}
      </div>

      {/* Day timeline */}
      <div className="card" style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>{t(lang, "today")}</div>
        {me.events.length === 0 ? (
          <div className="mut" style={{ fontSize: 13 }}>
            {t(lang, "timeline_empty")}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
            {me.events.map((e) => (
              <div key={e.id} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <span style={{ color: DOT[e.color] }}>●</span>
                <span>{eventText(lang, e).timeline}</span>
                <span className="mut" style={{ marginLeft: "auto", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                  {e.simTimeText}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Settings: collapsed by default so the screen stays calm. One tap opens them. */}
      <details className="card" style={{ marginTop: 14, padding: 0 }}>
        <summary
          style={{ minHeight: 52, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "0 14px", cursor: "pointer", fontWeight: 600, fontSize: 14, listStyle: "none" }}
        >
          <span>
            ⚙ {t(lang, "settings")} · {fmtDist(radius)} · {t(lang, nearMode)}
          </span>
          <span className="mut" aria-hidden="true">▾</span>
        </summary>
        <div style={{ padding: "0 14px 14px" }}>
      {/* Alert distance */}
      <div style={{ fontSize: 13, fontWeight: 600 }}>{t(lang, "alert_within")}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginTop: 6 }}>
        {me.radiusOptions.map((o) => {
          const on = o.m === radius;
          return (
            <button
              key={o.m}
              onClick={() => chooseRadius(o.m)}
              style={{
                minHeight: 56,
                padding: "6px 2px",
                lineHeight: 1.25,
                background: on ? "var(--teal)" : "#fff",
                color: on ? "#fff" : "var(--ink)",
                borderColor: on ? "var(--teal)" : undefined,
              }}
            >
              <div style={{ fontWeight: 600 }}>{fmtDist(o.m)}</div>
              <div style={{ fontSize: 11, opacity: 0.85 }}>{t(lang, "approx", { n: o.minutes })}</div>
            </button>
          );
        })}
      </div>

      {/* Bus-near setting: ring like a call, or just a notification */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 14, fontSize: 13 }}>
        <span>{t(lang, "near_is")}</span>
        <div style={{ display: "flex", gap: 6 }}>
          {(["alarm", "notification"] as const).map((m) => (
            <button
              key={m}
              onClick={() => chooseNearMode(m)}
              style={{
                minHeight: 48,
                padding: "6px 14px",
                background: nearMode === m ? "var(--teal)" : "#fff",
                color: nearMode === m ? "#fff" : "var(--ink)",
                borderColor: nearMode === m ? "var(--teal)" : undefined,
              }}
            >
              {t(lang, m)}
            </button>
          ))}
        </div>
      </div>
      <div className="mut" style={{ fontSize: 12, marginTop: 4 }}>
        {t(lang, "red_note")}
      </div>

          <StopChange childId={childId} routes={routes} lang={lang} />
        </div>
      </details>
    </main>
  );
}
