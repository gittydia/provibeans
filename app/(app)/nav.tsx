"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/lots", label: "Lots & receiving" },
  { href: "/issue", label: "Issue & movements" },
  { href: "/requests", label: "Order requests" },
  { href: "/catalog", label: "Products & suppliers" },
  { href: "/reports", label: "Reports & activity" },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="System sections">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={pathname === link.href ? "page" : undefined}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}