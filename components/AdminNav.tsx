"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  {
    href: "/headcount",
    label: "Sessions",
  },
  {
    href: "/registrations",
    label: "Registrations",
  },
  {
    href: "/attendance",
    label: "Attendance",
  },
  {
    href: "/coach",
    label: "Coach View",
  },
  {
    href: "/history",
    label: "Reports",
  },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav
      style={{
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
        marginBottom: 20,
      }}
    >
      {links.map((link) => {
        const active =
          pathname === link.href ||
          pathname.startsWith(`${link.href}/`);

        return (
          <Link
            key={link.href}
            href={link.href}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              textDecoration: "none",
              border: active
                ? "1px solid #4ade80"
                : "1px solid #2a2a33",
              background: active ? "#15351f" : "transparent",
              color: active ? "#86efac" : "#d4d4db",
              fontWeight: active ? 700 : 500,
            }}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}