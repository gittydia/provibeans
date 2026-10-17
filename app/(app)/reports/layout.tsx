"use client";

import { SectionTabs } from "../ui/section-tabs";

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Reports &amp; activity</h1>
          <p>
            The movement ledger is append-only. Corrections are recorded as reversals, so the history of what
            happened always stays readable.
          </p>
        </div>
      </div>

      <SectionTabs
        ariaLabel="Reports and activity"
        items={[
          { href: "/reports", label: "Stock by batch" },
          { href: "/reports/movements", label: "Movements" },
          { href: "/reports/activity", label: "Activity" },
          { href: "/reports/periods", label: "Periodic reports" },
        ]}
      />

      {children}
    </>
  );
}
