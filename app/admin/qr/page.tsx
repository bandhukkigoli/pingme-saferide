"use client";
// Printable sheet of QR codes: one bag tag per child, 3 unregistered tags, and a "join the demo" code.
// The QR text is a link (origin + /t/TAGCODE). The qrcode package draws each code in the browser.
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { usePoll } from "@/components/usePoll";
import type { World } from "@/lib/types";

type Item = { key: string; title: string; sub: string; code: string; url: string };

export default function QrSheetPage() {
  const { data: world, error } = usePoll<World>("/api/state", 5000);
  const [images, setImages] = useState<Record<string, string>>({});
  const [joinImg, setJoinImg] = useState("");

  // Build the list of tags to print (only when the children list changes size).
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const items: Item[] = [
    ...(world?.children ?? []).map((c) => ({ key: c.tagCode, title: c.name, sub: c.classSection, code: c.tagCode, url: `${origin}/t/${c.tagCode}` })),
    ...["PM-BAG-9001", "PM-BAG-9002", "PM-BAG-9003"].map((code) => ({ key: code, title: "New tag (unregistered)", sub: "", code, url: `${origin}/t/${code}` })),
  ];
  const count = world?.children.length ?? 0;

  useEffect(() => {
    if (!world) return;
    let stop = false;
    (async () => {
      const out: Record<string, string> = {};
      for (const it of items) out[it.key] = await QRCode.toDataURL(it.url, { width: 220, margin: 1 });
      const join = await QRCode.toDataURL(`${window.location.origin}/join`, { width: 420, margin: 1 });
      if (!stop) {
        setImages(out);
        setJoinImg(join);
      }
    })();
    return () => {
      stop = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  if (!world) {
    return <main style={{ padding: 16 }}>{error ? <div className="alert">{error}</div> : <div className="mut">Loading…</div>}</main>;
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 14 }}>
      {/* Print rules: hide the role bar and the Print button, keep tags together on a page */}
      <style>{`
        .qr-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
        @media(min-width:700px){.qr-grid{grid-template-columns:repeat(4,1fr)}}
        @media print{nav,.no-print{display:none !important} body{background:#fff} .qr-card{break-inside:avoid}}
      `}</style>

      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ fontWeight: 600, fontSize: 17 }}>Bag tag QR sheet</div>
        <button className="pri" style={{ minHeight: 48 }} onClick={() => window.print()}>Print</button>
      </div>

      <div className="card qr-card" style={{ textAlign: "center", marginBottom: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 20 }}>Scan to join the demo</div>
        {joinImg && <img src={joinImg} alt="QR code to join the demo" width={260} height={260} style={{ margin: "8px auto" }} />}
        <div className="mut" style={{ fontSize: 12 }}>{origin}/join</div>
      </div>

      <div className="qr-grid">
        {items.map((it) => (
          <div key={it.key} className="card qr-card" style={{ textAlign: "center", padding: 10 }}>
            {images[it.key] ? <img src={images[it.key]} alt={`QR for ${it.code}`} width={150} height={150} style={{ margin: "0 auto" }} /> : <div style={{ height: 150 }} />}
            <div style={{ fontWeight: 600, fontSize: 13 }}>{it.title}</div>
            {it.sub && <div className="mut" style={{ fontSize: 12 }}>{it.sub}</div>}
            <div className="mut" style={{ fontSize: 11 }}>{it.code}</div>
          </div>
        ))}
      </div>
    </main>
  );
}
