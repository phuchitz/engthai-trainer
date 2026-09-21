"use client";

import { useEffect, useRef } from "react";
import type { VocabularyEntry } from "@/lib/models";
import { contextualMeaning } from "@/lib/study";
import { speak } from "@/lib/speech/tts";
import { NavIcon } from "@/components/layout/NavIcon";

const SPEAKER_ICON = "M11 5 6 9H2v6h4l5 4V5Zm4.5 3a5 5 0 0 1 0 8m2.5-11a9 9 0 0 1 0 14";

export type WordPanelData = {
  word: string;
  entry: VocabularyEntry | undefined;
  sentenceId: string;
  encounters: number;
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="text-muted w-28 shrink-0">{label}</span>
      <span className="min-w-0">{children}</span>
    </div>
  );
}

export function WordPanel({
  data,
  onClose,
  onToggleSaved,
}: {
  data: WordPanelData;
  onClose: () => void;
  onToggleSaved: (entry: VocabularyEntry) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const { entry, word, sentenceId, encounters } = data;
  const context = entry ? contextualMeaning(entry, sentenceId) : undefined;

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="dialog"
      aria-label={`About the word ${word}`}
      className="border-border bg-surface mt-3 space-y-3 rounded-xl border p-4 outline-none"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-medium">{entry?.en ?? word}</p>
          {entry?.ipa ? <p className="text-muted font-mono text-xs">{entry.ipa}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => speak(entry?.en ?? word, { lang: "en-US" })}
            aria-label={`Play ${entry?.en ?? word}`}
            className="border-border text-muted rounded-lg border p-2"
          >
            <NavIcon path={SPEAKER_ICON} className="size-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close word panel"
            className="text-muted rounded-lg px-2 py-1 text-sm"
          >
            ✕
          </button>
        </div>
      </div>

      {entry ? (
        <>
          <div className="space-y-2">
            {entry.pos ? <Row label="Part of speech">{entry.pos}</Row> : null}
            <Row label="Thai">
              <span lang="th">{entry.th}</span>
              {entry.transliteration ? (
                <span className="text-muted block text-xs">{entry.transliteration}</span>
              ) : null}
            </Row>
            {entry.senseNote ? <Row label="Sense">{entry.senseNote}</Row> : null}
            <Row label="In this sentence">
              {context ? (
                <span lang="th">{context}</span>
              ) : (
                <span className="text-muted">No note for this sentence yet.</span>
              )}
            </Row>
            {entry.exampleEn ? (
              <Row label="Example">
                <span>{entry.exampleEn}</span>
                {entry.exampleTh ? (
                  <span lang="th" className="text-muted block">
                    {entry.exampleTh}
                  </span>
                ) : null}
              </Row>
            ) : null}
            <Row label="Encountered">
              {encounters === 0
                ? "not yet in practice"
                : `${encounters} ${encounters === 1 ? "time" : "times"}`}
            </Row>
          </div>

          <button
            type="button"
            onClick={() => onToggleSaved(entry)}
            aria-pressed={entry.saved}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              entry.saved ? "border-border text-muted border" : "bg-accent text-accent-foreground"
            }`}
          >
            {entry.saved ? "Saved — remove" : "Save word"}
          </button>
        </>
      ) : (
        /* No curated entry. Nothing is generated here: an invented definition or a
           guessed pronunciation would be worse than an honest gap. */
        <div className="space-y-2">
          <p className="text-muted text-sm">
            No dictionary entry for <span className="text-foreground">{word}</span> yet.
          </p>
          <p className="text-muted text-xs">
            Only hand-written entries are shown, so nothing here is guessed. You can still play the word to
            hear it.
          </p>
        </div>
      )}
    </div>
  );
}
