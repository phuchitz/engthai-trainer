"use client";

import { useEffect } from "react";
import { lookupWord } from "@/lib/study";
import { useVocabStore } from "@/stores/useVocabStore";
import { WordPanel } from "./WordPanel";

/**
 * Renders the word panel for whichever word is currently open, and loads the curated
 * vocabulary the first time a study screen mounts.
 */
export function WordPanelHost() {
  const { openWord, lookup, encounters, closePanel, toggleSaved, load, status } = useVocabStore();

  useEffect(() => {
    void load();
  }, [load]);

  if (!openWord || status !== "ready") return null;

  const entry = lookupWord(lookup, openWord.word);

  return (
    <WordPanel
      data={{
        word: openWord.word,
        entry,
        sentenceId: openWord.sentenceId,
        encounters: entry ? (encounters.get(entry.id) ?? 0) : 0,
      }}
      onClose={closePanel}
      onToggleSaved={(e) => void toggleSaved(e.id)}
    />
  );
}
