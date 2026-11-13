// Landing page: what PingME SafeRide is, why it exists, and where to go next.
import Link from "next/link";
import Logo from "@/components/Logo";

const ROLES = [
  { label: "Attendant", href: "/bus/4" },
  { label: "School desk", href: "/school" },
  { label: "Teacher", href: "/teacher/3-B" },
  { label: "Admin", href: "/admin/demo" },
];

export default function Landing() {
  return (
    <main style={{ maxWidth: 520, margin: "0 auto", padding: "28px 18px 40px", textAlign: "center" }}>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <Logo size={72} />
      </div>
      <h1 style={{ fontSize: 28, fontWeight: 700, margin: "12px 0 4px" }}>PingME SafeRide</h1>
      <div style={{ color: "var(--teal)", fontWeight: 600, fontSize: 16 }}>Track the child, not just the bus</div>

      <p className="mut" style={{ fontSize: 15, lineHeight: 1.5, marginTop: 16, textAlign: "left" }}>
        In the Noida case, a sleeping child was locked inside a parked school bus for about seven hours. Schools track
        buses, not children, so nobody knew. SafeRide scans each child on and off with a bag tag, so the school and the
        parent know exactly who is on the bus, and the trip cannot close while a child is still on board.
      </p>

      <Link href="/join">
        <button className="pri" style={{ width: "100%", minHeight: 56, fontSize: 17, marginTop: 14 }}>Try it as a parent</button>
      </Link>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 }}>
        {ROLES.map((r) => (
          <Link key={r.href} href={r.href}>
            <button style={{ width: "100%", minHeight: 48 }}>{r.label}</button>
          </Link>
        ))}
      </div>

      <div className="mut" style={{ fontSize: 12, marginTop: 28 }}>
        Demo with simulated data. No real people. Only the bus is located, never a person.
      </div>
    </main>
  );
}
