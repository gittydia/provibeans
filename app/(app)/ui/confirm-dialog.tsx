"use client";

import { useRef } from "react";
import { Dialog, DialogActions } from "./dialog";

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  onConfirm,
  pending = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  onConfirm: () => void;
  pending?: boolean;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  function confirm() {
    onConfirm();
    if (!pending) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} description={description}>
      <DialogActions>
        <button
          ref={cancelRef}
          type="button"
          className="btn btn-quiet"
          data-dialog-initial-focus={tone === "danger" ? "" : undefined}
          onClick={() => onOpenChange(false)}
          disabled={pending}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          className={tone === "danger" ? "btn btn-danger" : "btn"}
          onClick={confirm}
          disabled={pending}
        >
          {confirmLabel}
        </button>
      </DialogActions>
    </Dialog>
  );
}
