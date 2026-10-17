"use client";

import { SectionTabs } from "../ui/section-tabs";

export default function BatchesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Batches &amp; receiving</h1>
          <p>
            Every batch carries its own dates. Receiving writes a receipt movement rather than editing a stored
            total, so the ledger stays the single source of truth.
          </p>
        </div>
      </div>

      <SectionTabs
        ariaLabel="Batches and receiving"
        items={[
          { href: "/batches", label: "All batches" },
          { href: "/batches/receive", label: "Receive" },
          { href: "/batches/quarantine", label: "Quarantine" },
        ]}
      />

      {children}
    </>
  );
}
