"use client";

import { SectionTabs } from "../ui/section-tabs";

export default function IssueLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Issue &amp; movements</h1>
          <p>
            Leave the batch empty to let FEFO allocate across valid batches. Expired and quarantined stock is excluded
            automatically and can never be issued.
          </p>
        </div>
      </div>

      <SectionTabs
        ariaLabel="Issue and movements"
        items={[
          { href: "/issue", label: "Issue stock" },
          { href: "/issue/movements", label: "Movements" },
        ]}
      />

      {children}
    </>
  );
}
