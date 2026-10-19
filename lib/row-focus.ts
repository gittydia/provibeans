"use client";

import { useEffect, useState } from "react";

/**
 * Follows `?focus=` from a notification link down to the row it names.
 *
 * The query string is read from `window.location` rather than from
 * `useSearchParams()`: these list pages are statically rendered, and
 * `useSearchParams()` would put each of them behind a Suspense boundary for a
 * value that only the click arriving here can supply.
 *
 * The subscription covers the half a mount-time read cannot. A toast clicked
 * while its target list is already on screen -- the demo raises one on any
 * screen -- navigates to the route it is already on, so the page never remounts
 * and nothing re-reads the URL.
 */
let followFocus: ((key: string | null) => void) | null = null;

function focusKeyIn(search: string): string | null {
  return new URLSearchParams(search).get("focus");
}

/** Called by a notification link before it navigates, with the href it follows. */
export function requestRowFocus(href: string): void {
  followFocus?.(focusKeyIn(href.split("?")[1] ?? ""));
}

/** The `focus` key this page was opened with, or null. */
export function useRowFocus(): string | null {
  const [focus, setFocus] = useState<string | null>(null);

  useEffect(() => {
    followFocus = setFocus;
    setFocus(new URLSearchParams(window.location.search).get("focus"));
    return () => {
      followFocus = null;
    };
  }, []);

  useEffect(() => {
    if (!focus) return;
    const row = document.querySelector(`[data-focus-key="${CSS.escape(focus)}"]`);
    row?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focus]);

  return focus;
}
