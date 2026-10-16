"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { NotificationBell } from "./notifications/bell";
import { NotificationsProvider } from "./notifications/store";

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
  const [isOpen, setIsOpen] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const query = window.matchMedia(desktopQuery);
    const syncViewport = () => {
      setIsDesktop(query.matches);
      setIsOpen(query.matches);
    };

    syncViewport();
    query.addEventListener("change", syncViewport);
    return () => query.removeEventListener("change", syncViewport);
  }, []);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isDesktop) setIsOpen(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isDesktop]);

  useEffect(() => {
    if (isOpen && !isDesktop) closeButton.current?.focus();
  }, [isDesktop, isOpen]);

  const closeOnMobileNavigation = () => {
    if (!isDesktop) setIsOpen(false);
  };

  /* One label drives both the accessible name and the tooltip, so the two can
     never describe different actions. */
  const toggleLabel = isDesktop
    ? isOpen
      ? "Collapse navigation"
      : "Expand navigation"
    : "Close navigation";

  return (
    <NotificationsProvider>
      <div className={`app-wrap ${isOpen ? "sidebar-open" : "sidebar-closed"}`}>
        <button
          type="button"
          className="mobile-nav-toggle"
          aria-controls="primary-navigation"
          aria-expanded={isOpen}
          aria-label="Open navigation"
          data-tooltip="Open navigation"
          onClick={() => setIsOpen(true)}
        >
          <NavIcon>
            <path d="M4 7h16M4 12h16M4 17h16" />
          </NavIcon>
        </button>
        <div className="mobile-bar">
          <NotificationBell variant="bar" />
        </div>
        <button
          type="button"
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setIsOpen(false)}
        />
        <div className="shell">
          <aside className="side" id="primary-navigation" onClick={closeOnMobileNavigation}>
            <button
              ref={closeButton}
              type="button"
              className="sidebar-toggle"
              aria-controls="primary-navigation"
              aria-expanded={isOpen}
              aria-label={toggleLabel}
              data-tooltip={toggleLabel}
              onClick={(event) => {
                event.stopPropagation();
                setIsOpen((open) => !open);
              }}
            >
              <NavIcon>
                <path d="m14 6-6 6 6 6" />
              </NavIcon>
            </button>
            <NotificationBell variant="sidebar" />
            <div className="side-scroll">{sidebar}</div>
          </aside>
          <main className="main">{children}</main>
        </div>
      </div>
    </NotificationsProvider>
  );
}
