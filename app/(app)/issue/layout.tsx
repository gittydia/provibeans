"use client";

import { SectionTabs } from "../ui/section-tabs";

export default function IssueLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Issue &amp; stock changes</h1>
          <p>
            Leave the batch blank to draw from the batches that expire soonest. Expired and on-hold stock is excluded
            automatically and can never be issued.
          </p>
        </div>
      </div>

      <SectionTabs
          ariaLabel="Issue and stock changes"
        items={[
          { href: "/issue", label: "Issue stock" },
          { href: "/issue/movements", label: "Stock changes" },
        ]}
      />

      {children}
    </>
  );
}
