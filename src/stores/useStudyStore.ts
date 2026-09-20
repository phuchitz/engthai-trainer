"use client";

import { create } from "zustand";
import type { Category, Sentence, Settings, VocabularyEntry } from "@/lib/models";
import { seedDatabase } from "@/lib/db/seed";
import { loadSettings } from "@/lib/db/repositories/settings";
import { putSession } from "@/lib/db/repositories/sessions";
import { listAttemptsOnLocalDay } from "@/lib/db/repositories/attempts";
import { getVocabularyEntry } from "@/lib/db/repositories/vocabulary";
import {
  buildStudyQueue,
  cardsCompletedToday,
  skipCard,
  submitAnswer,
  type SubmitOutcome,
} from "@/lib/study";
import { currentStreak } from "@/lib/gamification";
import { newId } from "@/lib/utils/id";

export type StudyPhase = "idle" | "loading" | "prompt" | "graded" | "finished" | "error";

type StudyState = {
  phase: StudyPhase;
  error: string | null;

  sessionId: string | null;
  category: Category | null;
  cards: Sentence[];
  index: number;
  vocabulary: VocabularyEntry[];

  answer: string;
  hintUsed: boolean;
  ttsUsed: boolean;
  cardStartedAt: number;
  /** Guards against a double submit from a fast second Enter press. */
  submitting: boolean;

  outcome: SubmitOutcome | null;
  sessionXp: number;
  cardsToday: number;
  dailyGoal: number;
  streak: number;

  start: (category: Category) => Promise<void>;
  setAnswer: (value: string) => void;
  showHint: () => void;
  markTtsUsed: () => void;
  submit: () => Promise<void>;
  retry: () => void;
  skip: () => Promise<void>;
  next: () => Promise<void>;
  reset: () => void;
};

const BLANK = {
  answer: "",
  hintUsed: false,
  ttsUsed: false,
  outcome: null,
  submitting: false,
};

async function loadVocabulary(sentence: Sentence | undefined): Promise<VocabularyEntry[]> {
  if (!sentence) return [];
  const entries = await Promise.all(sentence.vocabIds.map((id) => getVocabularyEntry(id)));
  return entries.filter((e): e is VocabularyEntry => e !== undefined);
}

async function readDailyTotals(settings: Settings, now: number) {
  const attempts = await listAttemptsOnLocalDay(now);
  return {
    cardsToday: cardsCompletedToday(attempts, now),
    dailyGoal: settings.dailyGoal,
    streak: currentStreak(settings.streak, now),
  };
}

export const useStudyStore = create<StudyState>((set, get) => ({
  phase: "idle",
  error: null,
  sessionId: null,
  category: null,
  cards: [],
  index: 0,
  vocabulary: [],
  cardStartedAt: 0,
  sessionXp: 0,
  cardsToday: 0,
  dailyGoal: 0,
  streak: 0,
  ...BLANK,

  start: async (category) => {
    set({ phase: "loading", error: null, category, sessionXp: 0, index: 0, ...BLANK });
    try {
      const now = Date.now();
      await seedDatabase();
      const settings = await loadSettings(now);
      const cards = await buildStudyQueue(category, settings, now);
      const totals = await readDailyTotals(settings, now);

      const sessionId = newId(now);
      await putSession({
        id: sessionId,
        kind: "lesson",
        lessonId: null,
        startedAt: now,
        endedAt: null,
        plannedCount: cards.length,
        completedCount: 0,
        correctCount: 0,
        xpEarned: 0,
        durationMs: 0,
      });

      set({
        sessionId,
        cards,
        vocabulary: await loadVocabulary(cards[0]),
        phase: cards.length === 0 ? "finished" : "prompt",
        cardStartedAt: now,
        ...totals,
      });
    } catch (error) {
      set({ phase: "error", error: error instanceof Error ? error.message : String(error) });
    }
  },

  setAnswer: (value) => set({ answer: value }),
  showHint: () => set({ hintUsed: true }),
  markTtsUsed: () => set({ ttsUsed: true }),

  submit: async () => {
    const { cards, index, sessionId, answer, hintUsed, ttsUsed, cardStartedAt, submitting, phase } = get();
    const sentence = cards[index];
    if (!sentence || !sessionId || submitting || phase !== "prompt") return;
    if (answer.trim().length === 0) return;

    set({ submitting: true });
    try {
      const outcome = await submitAnswer({
        sessionId,
        sentence,
        mode: "dictation",
        userAnswer: answer,
        durationMs: Date.now() - cardStartedAt,
        hintUsed,
        ttsUsed,
      });
      set((s) => ({
        outcome,
        phase: "graded",
        submitting: false,
        sessionXp: s.sessionXp + outcome.xpAwarded,
        cardsToday: outcome.cardsCompletedToday,
        streak: outcome.streak,
      }));
    } catch (error) {
      set({
        phase: "error",
        submitting: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },

  /** Clears the graded state so the same card can be attempted again. */
  retry: () => set({ ...BLANK, phase: "prompt", cardStartedAt: Date.now() }),

  skip: async () => {
    const { cards, index, sessionId, cardStartedAt, submitting } = get();
    const sentence = cards[index];
    if (!sentence || !sessionId || submitting) return;

    set({ submitting: true });
    try {
      await skipCard({
        sessionId,
        sentence,
        mode: "dictation",
        durationMs: Date.now() - cardStartedAt,
      });
      set({ submitting: false });
      await get().next();
    } catch (error) {
      set({
        phase: "error",
        submitting: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },

  next: async () => {
    const { cards, index } = get();
    const nextIndex = index + 1;
    if (nextIndex >= cards.length) {
      set({ phase: "finished", ...BLANK });
      return;
    }
    set({
      index: nextIndex,
      phase: "prompt",
      cardStartedAt: Date.now(),
      vocabulary: await loadVocabulary(cards[nextIndex]),
      ...BLANK,
    });
  },

  reset: () => set({ phase: "idle", sessionId: null, cards: [], index: 0, sessionXp: 0, ...BLANK }),
}));
