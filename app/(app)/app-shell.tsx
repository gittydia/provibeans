"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { NotificationBell } from "./notifications/bell";
import { NotificationsProvider } from "./notifications/store";

const desktopQuery = "(min-width: 861px)";

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

  return (
    <NotificationsProvider>
      <div className={`app-wrap ${isOpen ? "sidebar-open" : "sidebar-closed"}`}>
        <button
          type="button"
          className="mobile-nav-toggle"
          aria-controls="primary-navigation"
          aria-expanded={isOpen}
          onClick={() => setIsOpen(true)}
        >
          Menu
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
              aria-label={isDesktop ? (isOpen ? "Collapse navigation" : "Expand navigation") : "Close navigation"}
              onClick={(event) => {
                event.stopPropagation();
                setIsOpen((open) => !open);
              }}
            >
              {isDesktop ? (isOpen ? "Collapse" : "Open") : "Close"}
            </button>
            <NotificationBell variant="sidebar" />
            {sidebar}
          </aside>
          <main className="main">{children}</main>
        </div>
      </div>
    </NotificationsProvider>
  );
}
