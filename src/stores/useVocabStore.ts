"use client";

import { create } from "zustand";
import type { VocabularyEntry } from "@/lib/models";
import { listVocabulary, setVocabularySaved } from "@/lib/db/repositories/vocabulary";
import { listSentences } from "@/lib/db/repositories/sentences";
import { listAttemptsInRange } from "@/lib/db/repositories/attempts";
import { buildVocabLookup, encounterCounts, lookupWord, type VocabLookup } from "@/lib/study";
import type { LoadStatus } from "./useLibraryStore";

type VocabState = {
  status: LoadStatus;
  error: string | null;
  entries: VocabularyEntry[];
  lookup: VocabLookup;
  /** Derived from the attempt log, keyed by vocabulary id. */
  encounters: Map<string, number>;

  /** The word the learner tapped, if the panel is open. */
  openWord: { word: string; sentenceId: string } | null;

  load: () => Promise<void>;
  refresh: () => Promise<void>;
  openPanel: (word: string, sentenceId: string) => void;
  closePanel: () => void;
  toggleSaved: (id: string) => Promise<void>;
};

async function read() {
  const [entries, sentences, attempts] = await Promise.all([
    listVocabulary(),
    listSentences(),
    listAttemptsInRange(0, Date.now()),
  ]);

  return {
    entries: entries.sort((a, b) => a.en.localeCompare(b.en)),
    lookup: buildVocabLookup(entries),
    encounters: encounterCounts(attempts, sentences),
  };
}

export const useVocabStore = create<VocabState>((set, get) => ({
  status: "idle",
  error: null,
  entries: [],
  lookup: new Map(),
  encounters: new Map(),
  openWord: null,

  load: async () => {
    if (get().status === "loading" || get().status === "ready") return;
    set({ status: "loading", error: null });
    try {
      set({ ...(await read()), status: "ready" });
    } catch (error) {
      set({ status: "error", error: error instanceof Error ? error.message : String(error) });
    }
  },

  refresh: async () => {
    try {
      set({ ...(await read()), status: "ready", error: null });
    } catch (error) {
      set({ status: "error", error: error instanceof Error ? error.message : String(error) });
    }
  },

  openPanel: (word, sentenceId) => set({ openWord: { word, sentenceId } }),
  closePanel: () => set({ openWord: null }),

  toggleSaved: async (id) => {
    const entry = get().entries.find((e) => e.id === id);
    if (!entry) return;
    const updated = await setVocabularySaved(id, !entry.saved);
    if (!updated) return;
    set((s) => ({
      entries: s.entries.map((e) => (e.id === id ? updated : e)),
      lookup: buildVocabLookup(s.entries.map((e) => (e.id === id ? updated : e))),
    }));
  },
}));

/** Resolves the currently open word against the curated lookup. */
export function useOpenEntry(): VocabularyEntry | undefined {
  const { openWord, lookup } = useVocabStore();
  return openWord ? lookupWord(lookup, openWord.word) : undefined;
}
