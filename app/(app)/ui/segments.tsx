"use client";

import { useRef, type KeyboardEvent } from "react";

type SegmentItem = {
  id: string;
  label: string;
  count?: number;
};

export function Segments({
  ariaLabel,
  items,
  value,
  onChange,
  className,
}: {
  ariaLabel: string;
  items: SegmentItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function selectFromKeyboard(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | undefined;

    if (event.key === "ArrowLeft") nextIndex = (index - 1 + items.length) % items.length;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % items.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = items.length - 1;
    if (nextIndex === undefined) return;

    event.preventDefault();
    onChange(items[nextIndex].id);
    buttonRefs.current[nextIndex]?.focus();
  }

  return (
    <div role="tablist" aria-label={ariaLabel} className={`segments ${className ?? ""}`}>
      {items.map((item, index) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            ref={(element) => {
              buttonRefs.current[index] = element;
            }}
            type="button"
            role="tab"
            className="segment"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
            onKeyDown={(event) => selectFromKeyboard(event, index)}
          >
            {item.label}
            {item.count === undefined ? null : <span className="segment-count">{item.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
