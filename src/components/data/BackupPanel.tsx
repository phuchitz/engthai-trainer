"use client";

import { useState } from "react";
import {
  backupFilename,
  createBackup,
  deleteAllData,
  inspectBackup,
  restoreBackup,
  serializeBackup,
  type BackupInspection,
} from "@/lib/importexport";
import { downloadText } from "@/lib/importexport/download";
import { useLibraryStore } from "@/stores/useLibraryStore";

const CONFIRM_WORD = "DELETE";

type Status = { tone: "ok" | "bad"; message: string } | null;

export function BackupPanel() {
  const refresh = useLibraryStore((s) => s.refresh);

  const [status, setStatus] = useState<Status>(null);
  const [inspection, setInspection] = useState<BackupInspection | null>(null);
  const [busy, setBusy] = useState(false);

  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  async function exportBackup(): Promise<boolean> {
    setBusy(true);
    try {
      const backup = await createBackup();
      const saved = downloadText(backupFilename(), serializeBackup(backup));
      // Only claim a backup exists if the browser actually took the file.
      setStatus(
        saved
          ? { tone: "ok", message: `Backup saved with ${backup.data.sentences.length} sentences.` }
          : { tone: "bad", message: "The browser refused the download. Nothing was saved." },
      );
      return saved;
    } catch (error) {
      setStatus({ tone: "bad", message: `Export failed: ${error instanceof Error ? error.message : error}` });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function onRestoreFile(file: File | undefined) {
    if (!file) return;
    setStatus(null);
    setInspection(inspectBackup(await file.text()));
  }

  async function applyRestore() {
    if (!inspection?.ok) return;
    setBusy(true);
    try {
      await restoreBackup(inspection.backup);
      await refresh();
      setStatus({ tone: "ok", message: "Backup restored. Everything was replaced." });
      setInspection(null);
    } catch (error) {
      setStatus({
        tone: "bad",
        message: `Restore failed, nothing was changed: ${error instanceof Error ? error.message : error}`,
      });
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    setBusy(true);
    try {
      const result = await deleteAllData();
      if (result.deleted) {
        await refresh();
        setStatus({ tone: "ok", message: "All data deleted." });
        setDeleting(false);
        setConfirmText("");
      } else {
        setStatus({ tone: "bad", message: `Nothing was deleted: ${result.reason}` });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="border-border bg-surface space-y-3 rounded-xl border p-4">
        <div>
          <h3 className="text-sm font-medium">Backup</h3>
          <p className="text-muted mt-1 text-sm">
            A complete snapshot: sentences, vocabulary, schedules and your whole answer history. Your data
            lives only in this browser, so this file is the only copy that survives a cleared profile.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void exportBackup()}
          disabled={busy}
          className="bg-accent text-accent-foreground rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40"
        >
          Export backup
        </button>
      </section>

      <section className="border-border bg-surface space-y-3 rounded-xl border p-4">
        <div>
          <h3 className="text-sm font-medium">Restore</h3>
          <p className="text-muted mt-1 text-sm">
            Replaces <strong>everything</strong> with the contents of a backup file. The file is checked in
            full before anything is touched.
          </p>
        </div>

        <label className="border-border text-muted inline-block cursor-pointer rounded-lg border px-4 py-2 text-sm">
          Choose a backup file
          <input
            type="file"
            accept=".json,application/json"
            className="sr-only"
            onChange={(e) => void onRestoreFile(e.target.files?.[0])}
          />
        </label>

        {inspection && !inspection.ok ? (
          <div role="alert" className="border-danger/40 rounded-lg border p-3">
            <p className="text-danger text-sm font-medium">This is not a valid backup</p>
            <ul className="text-muted mt-1 list-disc space-y-0.5 pl-5 text-xs">
              {inspection.errors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {inspection?.ok ? (
          <div className="border-warning/40 rounded-lg border p-3">
            <p className="text-sm font-medium">Ready to restore</p>
            <ul className="text-muted mt-1 text-xs">
              {Object.entries(inspection.counts).map(([label, count]) => (
                <li key={label}>
                  {count} {label}
                </li>
              ))}
            </ul>
            <p className="text-warning mt-2 text-xs">
              Everything currently stored will be replaced. Export a backup first if you are unsure.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void applyRestore()}
                disabled={busy}
                className="bg-accent text-accent-foreground rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40"
              >
                Replace my data
              </button>
              <button
                type="button"
                onClick={() => setInspection(null)}
                className="border-border rounded-lg border px-4 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="border-danger/40 bg-surface space-y-3 rounded-xl border p-4">
        <div>
          <h3 className="text-danger text-sm font-medium">Delete all data</h3>
          <p className="text-muted mt-1 text-sm">
            Removes every sentence, word, schedule and answer from this browser. This cannot be undone.
          </p>
        </div>

        {!deleting ? (
          <button
            type="button"
            onClick={() => setDeleting(true)}
            className="border-danger/60 text-danger rounded-lg border px-4 py-2 text-sm font-medium"
          >
            Delete all data…
          </button>
        ) : (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => void exportBackup()}
              disabled={busy}
              className="border-border rounded-lg border px-4 py-2 text-sm disabled:opacity-40"
            >
              Export a backup first
            </button>

            <div>
              <label htmlFor="confirm-delete" className="text-muted block text-xs">
                Type {CONFIRM_WORD} to confirm
              </label>
              <input
                id="confirm-delete"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                autoComplete="off"
                className="border-border bg-background mt-1 w-40 rounded-lg border px-3 py-1.5 text-sm"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={busy || confirmText !== CONFIRM_WORD}
                className="bg-danger rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                Delete everything
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeleting(false);
                  setConfirmText("");
                }}
                className="border-border rounded-lg border px-4 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      {status ? (
        <p role="status" className={`text-sm ${status.tone === "ok" ? "text-success" : "text-danger"}`}>
          {status.message}
        </p>
      ) : null}
    </div>
  );
}
