"use client";
// Slim bar at the top of every page: hop between roles in the same live demo world.
// Remembers the last role in localStorage. (Production would use role-based login instead.)
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Logo from "./Logo";

const ROLES = [
  { key: "parent", label: "Parent", href: "/join" },
  { key: "attendant", label: "Attendant", href: "/bus/4" },
  { key: "school", label: "School", href: "/school" },
  { key: "teacher", label: "Teacher", href: "/teacher/3-B" },
  { key: "admin", label: "Admin", href: "/admin/demo" },
];

// Work out which role a page address belongs to.
function roleOf(path: string): string | null {
  if (path.startsWith("/p/") || path.startsWith("/join") || path.startsWith("/t/")) return "parent";
  if (path.startsWith("/bus")) return "attendant";
  if (path.startsWith("/school")) return "school";
  if (path.startsWith("/teacher")) return "teacher";
  if (path.startsWith("/admin")) return "admin";
  return null;
}

export default function RoleBar() {
  const path = usePathname() || "/";
  const current = roleOf(path);
  const [parentHref, setParentHref] = useState("/join");

  useEffect(() => {
    if (current) localStorage.setItem("saferide.role", current);
    // If this phone already joined as a parent, the Parent tab goes straight back to that child.
    const child = localStorage.getItem("saferide.childId");
    if (child) setParentHref(`/p/${child}`);
  }, [current, path]);

  return (
    <nav className="sticky top-0 z-[1000] flex items-center gap-0.5 overflow-x-auto border-b border-[var(--line)] bg-white px-1.5 py-1 text-[12.5px]">
      {/* Small padding + font so the logo and all five tabs fit on a 375 px screen */}
      <Link href="/" className="mr-0.5 flex flex-none items-center" aria-label="Home">
        <Logo size={26} />
      </Link>
      {ROLES.map((r) => (
        <Link
          key={r.key}
          href={r.key === "parent" ? parentHref : r.href}
          className={`flex min-h-[40px] flex-none items-center rounded-full px-2.5 ${current === r.key ? "bg-[var(--teal)] text-white" : "text-[var(--ink)] hover:bg-[var(--tealL)]"}`}
        >
          {r.label}
        </Link>
      ))}
    </nav>
  );
}
