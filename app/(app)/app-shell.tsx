"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { NotificationBell } from "./notifications/bell";
import { NotificationsProvider } from "./notifications/store";
import { AppNavStateProvider, RailNav } from "./nav";
import { ThemeButton } from "./ui/theme-button";
import { TableLabels } from "@/lib/table-labels";

const desktopQuery = "(min-width: 861px)";

/* One wrapper for both nav glyphs so the two controls cannot drift apart on
   stroke weight, sizing, or colour inheritance. `aria-hidden` because the
   accessible name is already on the button's aria-label and data-tooltip —
   announcing the shape as well would just be noise. */
function NavIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      className="toggle-icon"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function AppShell({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  const [isDesktop, setIsDesktop] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [overlay, setOverlay] = useState<"nav" | "notifications" | null>(null);
  const sidebarToggle = useRef<HTMLButtonElement>(null);
  const mobileToggle = useRef<HTMLButtonElement>(null);
  const previousOverlay = useRef<typeof overlay>(null);

  useEffect(() => {
    const query = window.matchMedia(desktopQuery);
    const syncViewport = () => {
      setIsDesktop(query.matches);
      if (query.matches) setOverlay((current) => current === "nav" ? null : current);
    };

    syncViewport();
    query.addEventListener("change", syncViewport);
    return () => query.removeEventListener("change", syncViewport);
  }, []);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || overlay === null) return;
      event.preventDefault();
      event.stopPropagation();
      setOverlay(null);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [overlay]);

  useEffect(() => {
    if (overlay === "nav") sidebarToggle.current?.focus({ preventScroll: true });
    if (previousOverlay.current === "nav" && overlay === null) mobileToggle.current?.focus({ preventScroll: true });
    previousOverlay.current = overlay;
  }, [overlay]);

  const closeOnMobileNavigation = (event: React.MouseEvent<HTMLElement>) => {
    if (!isDesktop && (event.target as Element).closest("a[href]")) setOverlay(null);
  };

  const sidebarOpen = isDesktop ? !desktopCollapsed : overlay === "nav";
  const navCollapsed = isDesktop && desktopCollapsed;

  /* One label drives both the accessible name and the tooltip, so the two can
     never describe different actions. */
  const toggleLabel = isDesktop
    ? !desktopCollapsed
      ? "Collapse navigation"
      : "Expand navigation"
    : "Close navigation";

  return (
    <NotificationsProvider>
      <TableLabels />
      {overlay !== null ? (
        <button
          type="button"
          className="sidebar-scrim"
          aria-label={overlay === "nav" ? "Close navigation" : "Close notifications"}
          onClick={() => setOverlay(null)}
        />
      ) : null}
      <div className={`app-wrap ${sidebarOpen ? "sidebar-open" : "sidebar-closed"}`}>
        <header className="mobile-topbar">
          <button
            ref={mobileToggle}
            type="button"
            className="mobile-nav-toggle"
            aria-controls="primary-navigation"
            aria-expanded={overlay === "nav"}
            aria-label="Open navigation"
            data-tooltip="Open navigation"
            onClick={() => setOverlay("nav")}
          >
            <NavIcon>
              <path d="M4 7h16M4 12h16M4 17h16" />
            </NavIcon>
          </button>
          <span>Provi Beans</span>
          <ThemeButton />
          <div className="mobile-bar">
            <NotificationBell
              variant="bar"
              open={overlay === "notifications"}
              onOpenChange={(open) => setOverlay(open ? "notifications" : null)}
            />
          </div>
        </header>
        <div className="shell">
          <aside className="side" id="primary-navigation" onClick={closeOnMobileNavigation}>
            <button
              ref={sidebarToggle}
              type="button"
              className="sidebar-toggle"
              aria-controls="primary-navigation"
              aria-expanded={sidebarOpen}
              aria-label={toggleLabel}
              data-tooltip={toggleLabel}
              onClick={() => {
                if (isDesktop) setDesktopCollapsed((collapsed) => !collapsed);
                else setOverlay(null);
              }}
            >
              <NavIcon>
                <path d="m14 6-6 6 6 6" />
              </NavIcon>
            </button>
            {/* Sits in the desktop controls row beside the bell; below 861px
                the sidebar copy is hidden and the topbar keeps the only one. */}
            <ThemeButton />
            <NotificationBell
              variant="sidebar"
              open={overlay === "notifications"}
              onOpenChange={(open) => setOverlay(open ? "notifications" : null)}
            />
            {navCollapsed ? <RailNav /> : null}
            <div className="side-scroll">
              <AppNavStateProvider collapsed={navCollapsed}>{sidebar}</AppNavStateProvider>
            </div>
          </aside>
          <main className="main">{children}</main>
        </div>
      </div>
    </NotificationsProvider>
  );
}
