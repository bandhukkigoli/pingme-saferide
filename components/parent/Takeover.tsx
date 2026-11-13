"use client";
// The full-screen coloured "takeover" shown when something new happens (bus near, missed bus, ...).
// This component watches the list of events. For every event it has not shown yet it:
//   - "info" events (and "near" when the parent chose Notification): shows the screen for ~5 s + short beep
//   - ALARM events ("red" always, "near" when the parent chose Alarm): full-screen "incoming call" with a
//     looping ringtone + vibration until the parent taps a button
//   - when the page is in the background, also shows a phone notification
// "Which events are new" is remembered per child in localStorage (saferide.seen.<childId> = highest id seen).
import { useCallback, useEffect, useRef, useState } from "react";
import type { ParentEvent } from "@/lib/types";
import { eventText, t, type Lang } from "@/lib/i18n";
import { post } from "@/components/usePoll";
import Logo from "@/components/Logo";
import { beep, showSystemNotification, startRing, stopRing, unlockAudio } from "./alarm";

// Background colour per event colour (same as the reference demo).
const COLORS: Record<string, string> = { blue: "#185FA5", amber: "#BA7517", green: "#3B6D11", red: "#A32D2D" };

interface Props {
  childId: number;
  events: ParentEvent[] | null; // me.events (oldest first), null while loading
  lang: Lang;
  nearMode: "alarm" | "notification";
}

interface Btn {
  label: string;
  run: () => void;
}

export default function Takeover({ childId, events, lang, nearMode }: Props) {
  const [active, setActive] = useState<ParentEvent | null>(null);
  const [toast, setToast] = useState("");
  const activeRef = useRef<ParentEvent | null>(null); // same as `active`, readable inside callbacks
  const queueRef = useRef<ParentEvent[]>([]); // events waiting for their turn
  const queuedIds = useRef<Set<number>>(new Set()); // ids already queued (never queue twice)
  const maxSeen = useRef<number | null>(null); // highest event id we have handled
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nearModeRef = useRef(nearMode);
  nearModeRef.current = nearMode;

  // Is this event an alarm (ringing) event?
  const isRing = (e: ParentEvent) => e.alarm === "red" || (e.alarm === "near" && nearModeRef.current === "alarm");

  // Show the next queued event if nothing is on screen.
  const pump = useCallback(() => {
    if (activeRef.current) return;
    const next = queueRef.current.shift();
    if (next) {
      activeRef.current = next;
      setActive(next);
    }
  }, []);

  // Close the current takeover and move to the next one.
  const close = useCallback(() => {
    stopRing();
    if (autoTimer.current) clearTimeout(autoTimer.current);
    activeRef.current = null;
    setActive(null);
    setToast("");
    pump();
  }, [pump]);

  // 1) Look for new events whenever the list changes.
  useEffect(() => {
    if (!events) return;
    const key = `saferide.seen.${childId}`;
    const firstLook = maxSeen.current === null;
    if (firstLook) {
      const stored = localStorage.getItem(key);
      maxSeen.current = stored === null ? -1 : Number(stored);
    }
    // After a full demo re-seed the database numbers events from 1 again: forget the old "seen" mark.
    const maxId = events.reduce((m, e) => Math.max(m, e.id), -1);
    if (events.length && maxId < (maxSeen.current as number)) maxSeen.current = maxId;
    const seenBefore = maxSeen.current as number;
    const stored = localStorage.getItem(key) !== null;

    const fresh = events.filter((e) => {
      if (queuedIds.current.has(e.id)) return false;
      // Red events the parent still has to answer are always shown.
      if (firstLook && e.alarm === "red" && e.needsResponse && e.response === null) return true;
      // Page reopened/reloaded while the newest alert is an unanswered alarm: ring again.
      if (firstLook && e.id === maxId && e.alarm !== "info" && e.response === null) return true;
      // Very first visit ever: everything already there counts as seen.
      if (firstLook && !stored) return false;
      return e.id > seenBefore;
    });

    const top = events.reduce((m, e) => Math.max(m, e.id), seenBefore);
    maxSeen.current = top;
    localStorage.setItem(key, String(top));

    fresh.forEach((e) => {
      queuedIds.current.add(e.id);
      queueRef.current.push(e);
    });
    pump();
  }, [events, childId, pump]);

  // 2) When an event goes on screen: sound, vibration, notification, auto-dismiss.
  useEffect(() => {
    if (!active) return;
    const ring = isRing(active);
    const tx = eventText(lang, active);
    if (ring) startRing();
    else {
      beep(active.color);
      autoTimer.current = setTimeout(close, 5000);
    }
    if (document.hidden) {
      showSystemNotification(tx.heading, tx.body, `saferide-${active.id}`, ring);
    }
    return () => {
      if (autoTimer.current) clearTimeout(autoTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // 3) Coming back to the page while an alarm is unanswered: make sure it is ringing.
  useEffect(() => {
    const onVisible = () => {
      const a = activeRef.current;
      if (!document.hidden && a && isRing(a)) {
        unlockAudio();
        startRing();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      stopRing();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!active) return null;

  const ring = isRing(active);
  const tx = eventText(lang, active);
  const child = String(active.params.child ?? "");

  // Send the parent's answer to the server, then close. If it fails, stay open and say so.
  const respond = async (response: string) => {
    try {
      await post("/api/events/respond", { eventId: active.id, response });
      close();
    } catch (err) {
      setToast((err as Error).message);
    }
  };
  const fakeCall = () => setToast(t(lang, "call_toast")); // no real call, just the idea

  // Which buttons does this event get?
  let buttons: Btn[];
  if (active.kind === "missed") {
    buttons = [
      { label: t(lang, "not_going", { child }), run: () => respond("Absent, parent informed") },
      { label: t(lang, "i_drop", { child }), run: () => respond("Parent dropping") },
    ];
  } else if (active.kind === "wrong_stop") {
    buttons = [
      { label: t(lang, "call_attendant"), run: fakeCall },
      { label: t(lang, "ok"), run: () => respond("Acknowledged") },
    ];
  } else if (active.kind === "not_scanned_off") {
    buttons = [
      { label: t(lang, "call_school"), run: fakeCall },
      { label: t(lang, "ok"), run: () => respond("Acknowledged") },
    ];
  } else if (ring) {
    buttons = [
      { label: t(lang, "im_going"), run: () => respond("I'm going") },
      { label: t(lang, "dismiss"), run: () => respond("Dismissed") },
    ];
  } else {
    buttons = [{ label: t(lang, "ok"), run: close }];
  }

  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: COLORS[active.color] ?? COLORS.blue,
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        padding: "28px 22px",
        animation: "pop .25s ease",
        overflowY: "auto",
      }}
    >
      {ring && (
        // "Incoming call" look: big pulsing logo
        <div className="blink" style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
          <Logo size={110} />
        </div>
      )}
      <div style={{ fontSize: 13, opacity: 0.85, textTransform: "uppercase", letterSpacing: ".08em", marginTop: ring ? 20 : 0, textAlign: ring ? "center" : "left" }}>
        {ring ? t(lang, "incoming") + " · " + tx.kicker : tx.kicker}
      </div>
      <div style={{ fontSize: 34, fontWeight: 700, lineHeight: 1.1, marginTop: ring ? 16 : 40, textAlign: ring ? "center" : "left" }}>{tx.heading}</div>
      <div style={{ fontSize: 16, opacity: 0.92, marginTop: 12, lineHeight: 1.5, textAlign: ring ? "center" : "left" }}>{tx.body}</div>

      <div style={{ marginTop: "auto", paddingTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
        {toast && (
          <div style={{ background: "rgba(0,0,0,.28)", borderRadius: 12, padding: "10px 12px", fontSize: 14, textAlign: "center" }}>{toast}</div>
        )}
        {buttons.map((b, i) => (
          <button
            key={b.label}
            onClick={b.run}
            style={{
              minHeight: 52,
              padding: 13,
              fontSize: 16,
              borderRadius: 12,
              color: i === 0 ? "#1d1d1b" : "#fff",
              background: i === 0 ? "#fff" : "rgba(255,255,255,.18)",
              border: i === 0 ? "1px solid #fff" : "1px solid rgba(255,255,255,.45)",
            }}
          >
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}
