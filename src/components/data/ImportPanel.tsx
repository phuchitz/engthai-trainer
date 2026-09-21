"use client";

import { useState } from "react";
import {
  applyImportPlan,
  buildImportPlan,
  loadExistingForDuplicates,
  readSource,
  summarize,
  type DuplicateMode,
  type ImportPlan,
  type ImportResult,
  type SourceFormat,
} from "@/lib/importexport";
import { useLibraryStore } from "@/stores/useLibraryStore";

const FORMATS: { id: SourceFormat; label: string; hint: string }[] = [
  { id: "paste", label: "Paste", hint: "One pair per line: English, then a tab or |, then Thai." },
  { id: "csv", label: "CSV", hint: "A header row with at least english and thai columns." },
  { id: "json", label: "JSON", hint: "An array of objects, or { sentences: [...] }." },
];

const SAMPLE: Record<SourceFormat, string> = {
  paste: "Good morning | อรุณสวัสดิ์\nSee you tomorrow | แล้วเจอกันพรุ่งนี้",
  csv:
    'english,thai,level,category\nGood morning,อรุณสวัสดิ์,A1,daily\n"Let' +
    "'" +
    's go, then",ไปกันเถอะ,A2,daily',
  json: '[{ "english": "Good morning", "thai": "อรุณสวัสดิ์", "level": "A1" }]',
};

function Pill({ children, tone }: { children: React.ReactNode; tone: "ok" | "warn" | "bad" }) {
  const colour = tone === "ok" ? "text-success" : tone === "warn" ? "text-warning" : "text-danger";
  return <span className={`${colour} text-xs font-medium`}>{children}</span>;
}

export function ImportPanel() {
  const refresh = useLibraryStore((s) => s.refresh);

  const [format, setFormat] = useState<SourceFormat>("paste");
  const [text, setText] = useState("");
  const [mode, setMode] = useState<DuplicateMode>("skip");
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const summary = plan ? summarize(plan, mode) : null;

  async function preview(source: string) {
    setResult(null);
    setError(null);
    try {
      const existing = await loadExistingForDuplicates();
      setPlan(buildImportPlan(readSource(format, source), existing));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPlan(null);
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    const content = await file.text();
    setText(content);
    await preview(content);
  }

  async function apply() {
    if (!plan) return;
    setBusy(true);
    setError(null);
    try {
      const applied = await applyImportPlan(plan, mode);
      setResult(applied);
      setPlan(null);
      setText("");
      await refresh();
    } catch (e) {
      // Nothing is claimed as imported unless the write actually returned.
      setError(e instanceof Error ? e.message : String(e));
      setResult(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Import format">
        {FORMATS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => {
              setFormat(option.id);
              setPlan(null);
              setResult(null);
            }}
            aria-pressed={format === option.id}
            className={`rounded-lg px-3 py-1.5 text-xs ${
              format === option.id
                ? "bg-accent text-accent-foreground font-medium"
                : "border-border text-muted border"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <p className="text-muted text-xs">{FORMATS.find((f) => f.id === format)!.hint}</p>

      <label htmlFor="import-text" className="sr-only">
        Lesson data to import
      </label>
      <textarea
        id="import-text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        spellCheck={false}
        placeholder={SAMPLE[format]}
        className="border-border bg-background focus:border-accent w-full rounded-lg border p-3 font-mono text-sm outline-none"
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void preview(text)}
          disabled={text.trim().length === 0}
          className="bg-foreground text-background rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40"
        >
          Preview
        </button>

        <label className="border-border text-muted cursor-pointer rounded-lg border px-4 py-2 text-sm">
          Choose a file
          <input
            type="file"
            accept=".json,.csv,.txt,text/plain,application/json,text/csv"
            className="sr-only"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
        </label>
      </div>

      {error ? (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      ) : null}

      {result ? (
        <div role="status" className="border-success/40 bg-surface rounded-xl border p-4 text-sm">
          <p className="text-success font-medium">Import complete</p>
          <p className="text-muted mt-1">
            {result.created} added, {result.updated} updated, {result.skipped} skipped
            {result.vocabularyCreated > 0 ? `, ${result.vocabularyCreated} words` : ""}.
          </p>
        </div>
      ) : null}

      {plan?.fatal ? (
        <p role="alert" className="text-danger text-sm">
          {plan.fatal}
        </p>
      ) : null}

      {plan && !plan.fatal && summary ? (
        <div className="border-border bg-surface space-y-4 rounded-xl border p-4">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span>
              <strong className="tabular-nums">{summary.total}</strong> rows read
            </span>
            <Pill tone="ok">{summary.create} new</Pill>
            <Pill tone="warn">{summary.duplicates} duplicate</Pill>
            <Pill tone="bad">{summary.rejected} rejected</Pill>
          </div>

          <div>
            <p className="text-muted mb-2 text-xs tracking-wide uppercase">Duplicates</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Duplicate handling">
              {(["skip", "update"] as DuplicateMode[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setMode(option)}
                  aria-pressed={mode === option}
                  className={`rounded-lg px-3 py-1.5 text-xs ${
                    mode === option
                      ? "bg-accent text-accent-foreground font-medium"
                      : "border-border text-muted border"
                  }`}
                >
                  {option === "skip" ? "Skip duplicates" : "Update existing"}
                </button>
              ))}
            </div>
            <p className="text-muted mt-2 text-xs">
              {mode === "skip"
                ? "Existing sentences are left untouched."
                : "Existing sentences get the new wording. Their schedule and answer history are kept."}
            </p>
          </div>

          <div className="max-h-72 overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-muted">
                <tr>
                  <th className="py-1 pr-2 font-normal">Line</th>
                  <th className="py-1 pr-2 font-normal">English</th>
                  <th className="py-1 pr-2 font-normal">Thai</th>
                  <th className="py-1 font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {plan.accepted.map((row) => (
                  <tr key={`ok-${row.line}`} className="border-border border-t">
                    <td className="text-muted py-1 pr-2 tabular-nums">{row.line}</td>
                    <td className="py-1 pr-2">{row.row.english}</td>
                    <td className="py-1 pr-2" lang="th">
                      {row.row.thai}
                    </td>
                    <td className="py-1">
                      {row.duplicateOf ? (
                        <Pill tone="warn">
                          {row.duplicateOf.kind === "existing"
                            ? "already in your library"
                            : `repeat of line ${row.duplicateOf.line}`}
                        </Pill>
                      ) : (
                        <Pill tone="ok">new</Pill>
                      )}
                      {row.warnings.map((warning) => (
                        <span key={warning} className="text-muted block">
                          {warning}
                        </span>
                      ))}
                    </td>
                  </tr>
                ))}
                {plan.rejected.map((row) => (
                  <tr key={`bad-${row.line}`} className="border-border border-t">
                    <td className="text-muted py-1 pr-2 tabular-nums">{row.line}</td>
                    <td className="text-muted py-1 pr-2" colSpan={2}>
                      —
                    </td>
                    <td className="py-1">
                      <Pill tone="bad">{row.errors.join("; ")}</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={() => void apply()}
            disabled={busy || summary.willWrite === 0}
            className="bg-accent text-accent-foreground rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            {summary.willWrite === 0
              ? "Nothing to import"
              : `Import ${summary.willWrite} ${summary.willWrite === 1 ? "sentence" : "sentences"}`}
          </button>
        </div>
      ) : null}
    </section>
  );
}
