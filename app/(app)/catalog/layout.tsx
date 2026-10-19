"use client";

import { canManageMasterData, useMockStore } from "@/lib/mock-store";
import { SectionTabs } from "../ui/section-tabs";

export default function CatalogLayout({ children }: { children: React.ReactNode }) {
  const { user } = useMockStore();
  if (!user) return null;
  const canEdit = canManageMasterData(user.role);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Products &amp; suppliers</h1>
          <p>
            Records. {canEdit ? "Your role may edit these records." : "Your role has read-only access here."}
          </p>
        </div>
      </div>

      <SectionTabs
        ariaLabel="Products and suppliers"
        items={[
          { href: "/catalog", label: "Products" },
          { href: "/catalog/suppliers", label: "Suppliers" },
          { href: "/catalog/deliveries", label: "Deliveries" },
        ]}
      />

      {children}
    </>
  );
}
