"use client";
// <BusMap .../> : the live map. Leaflet needs the browser's `window`, so we load it only on the client.
// Props are documented in BusMapInner.tsx.
import dynamic from "next/dynamic";
import type { BusMapProps } from "./BusMapInner";

const Inner = dynamic(() => import("./BusMapInner"), {
  ssr: false,
  loading: () => <div style={{ height: 220, borderRadius: 14, background: "#f1efe8" }} />,
});

export default function BusMap(props: BusMapProps) {
  return <Inner {...props} />;
}
