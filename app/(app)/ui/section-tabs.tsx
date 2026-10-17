"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type SectionTabItem = {
  href: string;
  label: string;
};

export function SectionTabs({
  ariaLabel,
  items,
}: {
  ariaLabel: string;
  items: SectionTabItem[];
}) {
  const pathname = usePathname();

  return (
    <nav className="segments section-tabs" aria-label={ariaLabel}>
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="segment"
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
