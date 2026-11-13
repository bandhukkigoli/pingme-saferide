// The frame around every page: role switcher bar on top, PWA manifest + icons in <head>.
import type { Metadata, Viewport } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import RoleBar from "@/components/RoleBar";

export const metadata: Metadata = {
  title: "PingME SafeRide",
  description: "Track the child, not just the bus.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon-192.png" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0F6E56" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <RoleBar />
        {children}
      </body>
    </html>
  );
}
