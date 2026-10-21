"use client";

import { useState } from "react";
import { useMockStore } from "@/lib/mock-store";

export function BackupPanel() {
  const { exportBackup, restoreBackup } = useMockStore();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const restore = async (file: File | undefined) => {
    if (!file) return;
    const outcome = restoreBackup(await file.text());
    setResult(outcome.ok
      ? { ok: true, message: outcome.message ?? "Backup restored." }
      : { ok: false, message: outcome.error ?? "That backup could not be restored." });
  };

  return (
    <section className="panel">
      <header>
        <h2>Backup and restore</h2>
        <p>Browser-local state</p>
      </header>
      <div className="panel-body">
        <div>
          <button
            type="button"
            className="btn"
            onClick={() => {
              exportBackup();
              setResult({ ok: true, message: "Backup downloaded." });
            }}
          >
            Download backup
          </button>{" "}
          <label className="btn btn-quiet">
            Restore from backup
            <input
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                void restore(file);
              }}
            />
          </label>
        </div>
        {result ? (
          <p className={result.ok ? "notice notice-ok" : "notice notice-crit"} role="status">
            {result.message}
          </p>
        ) : null}
        <p className="muted">
          A backup holds every product, batch, movement, account, and audit entry stored in this
          browser. Restoring replaces local data; if the backup has no account matching yours, you
          are signed out.
        </p>
      </div>
    </section>
  );
}
