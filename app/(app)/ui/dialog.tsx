"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useRef, type ReactNode } from "react";

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="ui-dialog-overlay" />
        <DialogPrimitive.Content
          ref={contentRef}
          className={`ui-dialog${className ? ` ${className}` : ""}`}
          {...(description ? {} : { "aria-describedby": undefined })}
          onOpenAutoFocus={(event) => {
            const initialFocus = contentRef.current?.querySelector<HTMLElement>(
              "[data-dialog-initial-focus]",
            );
            if (!initialFocus) return;
            event.preventDefault();
            initialFocus.focus();
          }}
        >
          <DialogPrimitive.Title className="ui-dialog-title">{title}</DialogPrimitive.Title>
          {description ? (
            <DialogPrimitive.Description className="ui-dialog-desc">
              {description}
            </DialogPrimitive.Description>
          ) : null}
          <DialogPrimitive.Close asChild>
            <button type="button" className="ui-dialog-close icon-btn" aria-label="Close">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
                <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </DialogPrimitive.Close>
          <div className="ui-dialog-body">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function DialogActions({ children }: { children: ReactNode }) {
  return <div className="ui-dialog-actions">{children}</div>;
}
