"use client";
// /join : the front door. Pick who you are. Big cards, one per row on a phone.
// "Parent" asks the server for a child (POST /api/join), remembers it on this phone, and opens /p/<id>.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/Logo";
import { post } from "@/components/usePoll";

const CARD: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "16px 18px",
  minHeight: 76,
  borderRadius: 18,
  border: "1px solid var(--line)",
  background: "#fff",
  color: "var(--ink)",
  textDecoration: "none",
};

function RoleCard({ title, hint, href, onClick }: { title: string; hint: string; href?: string; onClick?: () => void }) {
  const inner = (
    <>
      <div style={{ fontSize: 18, fontWeight: 600 }}>{title}</div>
      <div className="mut" style={{ fontSize: 13, marginTop: 2 }}>
        {hint}
      </div>
    </>
  );
  if (href)
    return (
      <Link href={href} style={CARD}>
        {inner}
      </Link>
    );
  return (
    <button onClick={onClick} style={CARD}>
      {inner}
    </button>
  );
}

export default function JoinPage() {
  const router = useRouter();
  const [savedId, setSavedId] = useState<number | null>(null);
  const [savedName, setSavedName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Does this phone already belong to a child? If so, offer to continue.
  useEffect(() => {
    const id = Number(localStorage.getItem("saferide.childId"));
    if (!id) return;
    setSavedId(id);
    fetch("/api/state", { cache: "no-store" })
      .then((r) => r.json())
      .then((w) => {
        const c = (w.children || []).find((x: { id: number; name: string }) => x.id === id);
        if (c) setSavedName(c.name);
      })
      .catch(() => {});
  }, []);

  // Ask the server for a child nobody else has, remember it, go to the parent page.
  const joinAsParent = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await post<{ childId: number }>("/api/join");
      localStorage.setItem("saferide.childId", String(res.childId));
      router.push(`/p/${res.childId}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "20px 14px 40px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Logo size={44} />
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>PingME SafeRide</div>
          <div className="mut" style={{ fontSize: 13 }}>
            Who are you?
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 18 }}>
        {savedId && (
          <RoleCard
            title={savedName ? `Continue as parent of ${savedName}` : "Continue as parent"}
            hint="Open your child's live page"
            href={`/p/${savedId}`}
          />
        )}
        <RoleCard
          title={savedId ? "Get a different child" : "Parent"}
          hint="See your child's bus live and get alerts"
          onClick={busy ? undefined : joinAsParent}
        />
        <RoleCard title="Bus driver / attendant" hint="Bus 4: scan children on and off" href="/bus/4" />
        <RoleCard title="School transport desk" hint="All buses, alerts, requests and routes" href="/school" />
        <RoleCard title="Class teacher" hint="Class 3-B attendance" href="/teacher/3-B" />
        <RoleCard title="Admin (demo control)" hint="Start trips and trigger test scenarios" href="/admin/demo" />
      </div>

      {error && <div style={{ color: "var(--red)", marginTop: 12, fontSize: 14 }}>{error}</div>}
      <p className="mut" style={{ fontSize: 12, marginTop: 18, textAlign: "center" }}>
        Demo mode, no login. Production uses role-based login.
      </p>
    </main>
  );
}
