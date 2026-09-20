"use client";

import { create } from "zustand";
import type { Lesson } from "@/lib/models";
import { seedDatabase } from "@/lib/db/seed";
import { listLessons } from "@/lib/db/repositories/lessons";
import { countSentences } from "@/lib/db/repositories/sentences";
import { countVocabulary } from "@/lib/db/repositories/vocabulary";
import { countDueProgress, countProgress } from "@/lib/db/repositories/progress";

export type LoadStatus = "idle" | "loading" | "ready" | "error";

type LibraryState = {
  status: LoadStatus;
  error: string | null;
  lessons: Lesson[];
  sentenceCount: number;
  vocabularyCount: number;
  progressCount: number;
  dueCount: number;
  /** Opens the database, seeds on first run, then loads counts. Safe to call repeatedly. */
  initialize: () => Promise<void>;
  refresh: () => Promise<void>;
};

async function readSnapshot() {
  const [lessons, sentenceCount, vocabularyCount, progressCount, dueCount] = await Promise.all([
    listLessons(),
    countSentences(),
    countVocabulary(),
    countProgress(),
    countDueProgress(Date.now()),
  ]);
  return { lessons, sentenceCount, vocabularyCount, progressCount, dueCount };
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  status: "idle",
  error: null,
  lessons: [],
  sentenceCount: 0,
  vocabularyCount: 0,
  progressCount: 0,
  dueCount: 0,

  initialize: async () => {
    if (get().status === "loading" || get().status === "ready") return;
    set({ status: "loading", error: null });
    try {
      await seedDatabase();
      set({ ...(await readSnapshot()), status: "ready" });
    } catch (error) {
      set({ status: "error", error: error instanceof Error ? error.message : String(error) });
    }
  },

  refresh: async () => {
    try {
      set({ ...(await readSnapshot()), status: "ready", error: null });
    } catch (error) {
      set({ status: "error", error: error instanceof Error ? error.message : String(error) });
    }
  },
}));
