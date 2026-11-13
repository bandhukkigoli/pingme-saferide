"use client";
// QrScanner: opens the phone camera and reports every QR code it sees via onCode(text).
// Uses the browser's built-in BarcodeDetector when it exists (fast, Chrome/Android),
// otherwise falls back to the html5-qrcode package (loaded only when needed).
// The parent decides what to do with the text and debounces repeats.
import { useEffect, useRef, useState } from "react";

export default function QrScanner({ onCode, onClose, closeLabel = "Close camera" }: { onCode: (text: string) => void; onClose: () => void; closeLabel?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState<string | null>(null);
  // keep the newest onCode without restarting the camera each render
  const cb = useRef(onCode);
  cb.current = onCode;

  useEffect(() => {
    let stopped = false;
    let cleanup: () => void = () => {};

    async function startNative() {
      const Detector = (window as any).BarcodeDetector;
      const detector = new Detector({ formats: ["qr_code"] });
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      // look at the camera picture ~5 times a second
      const timer = setInterval(async () => {
        try {
          const found = await detector.detect(video);
          if (found.length && !stopped) cb.current(found[0].rawValue);
        } catch {}
      }, 200);
      cleanup = () => {
        clearInterval(timer);
        stream.getTracks().forEach((t) => t.stop());
      };
    }

    async function startFallback() {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("qr-fallback-box");
      await scanner.start({ facingMode: "environment" }, { fps: 8, qrbox: 220 }, (text) => !stopped && cb.current(text), () => {});
      cleanup = () => {
        scanner.stop().then(() => scanner.clear()).catch(() => {});
      };
    }

    const run = "BarcodeDetector" in window ? startNative : startFallback;
    run().catch(() => setErr("Could not open the camera. Allow camera access, or use the Scan on / Scan off buttons below."));

    return () => {
      stopped = true;
      cleanup();
    };
  }, []);

  const native = typeof window !== "undefined" && "BarcodeDetector" in window;

  return (
    <div className="card" style={{ marginTop: 12, padding: 10 }}>
      {native ? (
        <video ref={videoRef} playsInline muted style={{ width: "100%", borderRadius: 12, background: "#000", maxHeight: 320, objectFit: "cover" }} />
      ) : (
        <div id="qr-fallback-box" style={{ width: "100%", minHeight: 240 }} />
      )}
      {err && <div style={{ color: "#A32D2D", fontSize: 13, marginTop: 8 }}>{err}</div>}
      <button onClick={onClose} style={{ width: "100%", marginTop: 8, minHeight: 48 }}>
        {closeLabel}
      </button>
    </div>
  );
}
