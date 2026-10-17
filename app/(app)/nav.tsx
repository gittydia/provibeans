"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, type ReactNode } from "react";
import { canManageAccounts, canViewReports, useMockStore } from "@/lib/mock-store";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/batches", label: "Batches & receiving", icon: "batches" },
  { href: "/issue", label: "Issue & movements", icon: "issue" },
  { href: "/catalog", label: "Products & suppliers", icon: "catalog" },
  { href: "/reports", label: "Reports & activity", icon: "reports" },
  { href: "/accounts", label: "Accounts", icon: "accounts" },
] as const;

const NavCollapsedContext = createContext(false);

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavItemIcon({ icon }: { icon: (typeof links)[number]["icon"] }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {icon === "dashboard" ? <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></> : null}
      {icon === "batches" ? <><path d="m4 7 8-4 8 4-8 4-8-4Z" /><path d="m4 12 8 4 8-4M4 17l8 4 8-4" /></> : null}
      {icon === "issue" ? <><path d="M4 12h13" /><path d="m13 8 4 4-4 4" /><path d="M20 5v14" /></> : null}
      {icon === "catalog" ? <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v17H6.5A2.5 2.5 0 0 0 4 22V5.5Z" /><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v17h4.5A2.5 2.5 0 0 1 20 22V5.5Z" /></> : null}
      {icon === "reports" ? <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></> : null}
      {icon === "accounts" ? <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></> : null}
    </svg>
  );
}

function useVisibleLinks() {
  const { user } = useMockStore();
  return links.filter((link) => {
    if (link.href === "/reports") return Boolean(user && canViewReports(user.role));
    if (link.href === "/accounts") return Boolean(user && canManageAccounts(user.role));
    return true;
  });
}

export function AppNavStateProvider({ collapsed, children }: { collapsed: boolean; children: ReactNode }) {
  return <NavCollapsedContext.Provider value={collapsed}>{children}</NavCollapsedContext.Provider>;
}

export function RailNav() {
  const pathname = usePathname();
  const visibleLinks = useVisibleLinks();

  return (
    <nav className="rail-nav" aria-label="Primary">
      {visibleLinks.map((link) => (
        <Link
          key={link.href}
          className="rail-link"
          href={link.href}
          aria-label={link.label}
          title={link.label}
          data-tooltip={link.label}
          aria-current={isActive(pathname, link.href) ? "page" : undefined}
        >
          <NavItemIcon icon={link.icon} />
        </Link>
      ))}
    </nav>
  );
}

export function AppNav() {
  const pathname = usePathname();
  const collapsed = useContext(NavCollapsedContext);
  const visibleLinks = useVisibleLinks();

  if (collapsed) return null;

  return (
    <nav aria-label="System sections">
      {visibleLinks.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={isActive(pathname, link.href) ? "page" : undefined}
        >
          <NavItemIcon icon={link.icon} />
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
