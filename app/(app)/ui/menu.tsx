"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

type RowMenuItem = {
  id: string;
  label: string;
  tone?: "default" | "danger";
  onSelect: () => void;
};

export function RowMenu({
  label,
  items,
  align = "end",
}: {
  label: string;
  items: RowMenuItem[];
  align?: "start" | "center" | "end";
}) {
  const defaultItems = items.filter((item) => item.tone !== "danger");
  const dangerItems = items.filter((item) => item.tone === "danger");

  function renderItem(item: RowMenuItem) {
    return (
      <DropdownMenu.Item
        key={item.id}
        className={`ui-menu-item${item.tone === "danger" ? " ui-menu-item--danger" : ""}`}
        onSelect={item.onSelect}
      >
        {item.label}
      </DropdownMenu.Item>
    );
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button type="button" className="icon-btn row-menu-trigger" aria-label={label}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
            <circle cx="12" cy="5" r="1.75" fill="currentColor" />
            <circle cx="12" cy="12" r="1.75" fill="currentColor" />
            <circle cx="12" cy="19" r="1.75" fill="currentColor" />
          </svg>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="ui-menu" align={align}>
          {defaultItems.map(renderItem)}
          {defaultItems.length > 0 && dangerItems.length > 0 ? (
            <DropdownMenu.Separator className="ui-menu-sep" />
          ) : null}
          {dangerItems.map(renderItem)}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
