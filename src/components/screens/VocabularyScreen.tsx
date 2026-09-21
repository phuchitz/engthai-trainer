"use client";

import { useEffect, useState } from "react";
import type { VocabularyEntry } from "@/lib/models";
import { speak } from "@/lib/speech/tts";
import { useLibrary } from "@/hooks/useLibrary";
import { useVocabStore } from "@/stores/useVocabStore";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/States";
import { NavIcon } from "@/components/layout/NavIcon";

const SPEAKER_ICON = "M11 5 6 9H2v6h4l5 4V5Zm4.5 3a5 5 0 0 1 0 8m2.5-11a9 9 0 0 1 0 14";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "saved", label: "Saved" },
  { id: "encountered", label: "Encountered" },
] as const;

type Filter = (typeof FILTERS)[number]["id"];

function WordCard({
  entry,
  encounters,
  onToggleSaved,
}: {
  entry: VocabularyEntry;
  encounters: number;
  onToggleSaved: () => void;
}) {
  return (
    <li className="border-border bg-surface rounded-xl border p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-2">
            <p className="font-medium">{entry.en}</p>
            {entry.pos ? <span className="text-muted text-xs">{entry.pos}</span> : null}
            {entry.ipa ? <span className="text-muted font-mono text-xs">{entry.ipa}</span> : null}
          </div>
          <p lang="th" className="mt-1">
            {entry.th}
          </p>
          {entry.transliteration ? <p className="text-muted text-xs">{entry.transliteration}</p> : null}
          {entry.senseNote ? <p className="text-muted mt-1 text-xs">{entry.senseNote}</p> : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => speak(entry.en, { lang: "en-US" })}
            aria-label={`Play ${entry.en}`}
            className="border-border text-muted rounded-lg border p-2"
          >
            <NavIcon path={SPEAKER_ICON} className="size-4" />
          </button>
          <button
            type="button"
            onClick={onToggleSaved}
            aria-pressed={entry.saved}
            aria-label={entry.saved ? `Remove ${entry.en} from saved` : `Save ${entry.en}`}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              entry.saved ? "bg-accent text-accent-foreground" : "border-border text-muted border"
            }`}
          >
            {entry.saved ? "Saved" : "Save"}
          </button>
        </div>
      </div>

      {entry.contexts.length > 0 ? (
        <p lang="th" className="text-muted mt-3 text-sm">
          {entry.contexts[0].meaning}
        </p>
      ) : null}

      {entry.exampleEn ? (
        <div className="border-border mt-3 border-t pt-3">
          <p className="text-sm">{entry.exampleEn}</p>
          {entry.exampleTh ? (
            <p lang="th" className="text-muted text-sm">
              {entry.exampleTh}
            </p>
          ) : null}
        </div>
      ) : null}

      <p className="text-muted mt-3 text-xs">
        {encounters === 0
          ? "Not encountered in practice yet"
          : `Encountered ${encounters} ${encounters === 1 ? "time" : "times"}`}
      </p>
    </li>
  );
}

export function VocabularyScreen() {
  const { status: libraryStatus, error: libraryError } = useLibrary();
  const { status, error, entries, encounters, load, toggleSaved } = useVocabStore();
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    if (libraryStatus === "ready") void load();
  }, [libraryStatus, load]);

  if (libraryStatus === "error") return <ErrorState message={libraryError ?? "Unknown error"} />;
  if (status === "error") return <ErrorState message={error ?? "Unknown error"} />;
  if (status !== "ready") return <LoadingState label="Loading vocabulary…" />;

  const visible = entries.filter((entry) => {
    if (filter === "saved") return entry.saved;
    if (filter === "encountered") return (encounters.get(entry.id) ?? 0) > 0;
    return true;
  });

  const savedCount = entries.filter((e) => e.saved).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter vocabulary">
        {FILTERS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setFilter(option.id)}
            aria-pressed={filter === option.id}
            className={`rounded-lg px-3 py-1.5 text-xs ${
              filter === option.id
                ? "bg-accent text-accent-foreground font-medium"
                : "border-border text-muted border"
            }`}
          >
            {option.label}
            {option.id === "saved" && savedCount > 0 ? ` (${savedCount})` : ""}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={filter === "saved" ? "No saved words yet" : "Nothing here yet"}
          description={
            filter === "saved"
              ? "Tap any English word while studying to open its panel, then save it."
              : "Words appear here once they are part of a sentence you have practised."
          }
        />
      ) : (
        <ul className="space-y-3">
          {visible.map((entry) => (
            <WordCard
              key={entry.id}
              entry={entry}
              encounters={encounters.get(entry.id) ?? 0}
              onToggleSaved={() => void toggleSaved(entry.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
