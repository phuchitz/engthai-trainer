"use client";

import { useEffect, useState } from "react";
import type { VocabularyEntry } from "@/lib/models";
import { useLibrary } from "@/hooks/useLibrary";
import { listVocabulary } from "@/lib/db/repositories/vocabulary";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/States";

export function VocabularyScreen() {
  const { status, error } = useLibrary();
  const [entries, setEntries] = useState<VocabularyEntry[] | null>(null);

  useEffect(() => {
    if (status !== "ready") return;
    void listVocabulary().then(setEntries);
  }, [status]);

  if (status === "idle" || status === "loading" || entries === null)
    return <LoadingState label="Loading vocabulary…" />;
  if (status === "error") return <ErrorState message={error ?? "Unknown error"} />;

  if (entries.length === 0) {
    return (
      <EmptyState
        title="No words saved yet"
        description="Vocabulary is collected from the sentences you study, and each word is scheduled independently of the sentences it appears in."
      />
    );
  }

  return (
    <ul className="divide-border border-border bg-surface divide-y overflow-hidden rounded-xl border">
      {entries.map((entry) => (
        <li key={entry.id} className="flex items-baseline justify-between gap-4 p-4">
          <div>
            <p className="font-medium">{entry.en}</p>
            {entry.senseNote ? <p className="text-muted text-xs">{entry.senseNote}</p> : null}
          </div>
          <div className="text-right">
            <p lang="th">{entry.th}</p>
            {entry.transliteration ? <p className="text-muted text-xs">{entry.transliteration}</p> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
