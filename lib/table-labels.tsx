"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Gives every table cell its column name, so narrow screens can stack each row
 * into a labelled block instead of scrolling sideways.
 *
 * A nine-column table cannot fit a phone, and a sideways-scrolling one hides its
 * most important column past the fold — the status badge is the last thing you
 * see. Stacking trades the grid for a list, which costs one attribute per cell.
 *
 * The labels are copied from the header row rather than hand-written into ~200
 * cells, so a renamed header cannot drift away from the label beside it.
 */
export function TableLabels() {
  const pathname = usePathname();

  useEffect(() => {
    const stamp = (root: ParentNode) => {
      for (const table of root.querySelectorAll("table")) {
        const head = table.tHead?.rows?.[0];
        if (!head) continue;
        const labels = [...head.cells].map((cell) => cell.textContent?.trim() ?? "");

        const sections: (HTMLTableSectionElement | null)[] = [
          table.tHead,
          ...[...table.tBodies],
          table.tFoot,
        ];

        for (const section of sections) {
          if (!section) continue;
          for (const row of section.rows) {
            for (const [index, cell] of [...row.cells].entries()) {
              const label = labels[index];
              if (label) cell.dataset.label = label;
            }
          }
        }
      }
    };

    stamp(document);

    // Rows added later (a form writing a new lot, a request changing state)
    // arrive without the attribute, so re-stamp whenever a table body changes.
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.target instanceof Element && record.target.closest("table")) stamp(record.target);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);

  return null;
}
