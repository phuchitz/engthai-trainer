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
  type ScoringOverride,
  type SubmitOutcome,
} from "@/lib/study";
import {
  createFillBlankPuzzle,
  createWordOrderPuzzle,
  fillIn,
  joinTokens,
  scoreBlanks,
  MODE_INFO,
  type FillBlankPuzzle,
  type ImplementedMode,
  type Token,
  type WordOrderPuzzle,
} from "@/lib/exercises";
import { currentStreak } from "@/lib/gamification";
import { newId } from "@/lib/utils/id";
import type { RecognitionFailure } from "@/lib/speech/stt";

export type StudyPhase = "idle" | "loading" | "prompt" | "graded" | "finished" | "error";

/** Speaking mode only: the microphone is off until the learner explicitly enables it. */
export type MicState = "idle" | "consented" | "listening" | "failed";

type StudyState = {
  phase: StudyPhase;
  error: string | null;

  sessionId: string | null;
  category: Category | null;
  mode: ImplementedMode;
  cards: Sentence[];
  index: number;
  vocabulary: VocabularyEntry[];

  answer: string;
  hintUsed: boolean;
  ttsUsed: boolean;
  cardStartedAt: number;
  submitting: boolean;

  /** Sentence Builder. */
  wordOrder: WordOrderPuzzle | null;
  placed: Token[];

  /** Fill in the Blank. */
  fillBlank: FillBlankPuzzle | null;
  blankAnswers: string[];

  /** Speaking. */
  micState: MicState;
  micFailure: RecognitionFailure | null;
  transcript: string | null;

  outcome: SubmitOutcome | null;
  sessionXp: number;
  cardsToday: number;
  dailyGoal: number;
  streak: number;

  start: (category: Category, mode: ImplementedMode) => Promise<void>;
  setAnswer: (value: string) => void;
  placeToken: (token: Token) => void;
  removeToken: (id: string) => void;
  clearPlaced: () => void;
  setBlankAnswer: (index: number, value: string) => void;
  setMicState: (state: MicState) => void;
  setMicFailure: (failure: RecognitionFailure | null) => void;
  setTranscript: (transcript: string) => void;
  showHint: () => void;
  markTtsUsed: () => void;
  submit: (options?: { selfAssessedPass?: boolean; force?: boolean }) => Promise<void>;
  /** Speaking only: grade by the learner's own judgement when transcription cannot. */
  selfAssess: (pass: boolean) => Promise<void>;
  retry: () => void;
  skip: () => Promise<void>;
  next: () => Promise<void>;
};

const BLANK = {
  answer: "",
  hintUsed: false,
  ttsUsed: false,
  outcome: null,
  submitting: false,
  placed: [] as Token[],
  blankAnswers: [] as string[],
  micState: "idle" as MicState,
  micFailure: null as RecognitionFailure | null,
  transcript: null as string | null,
};

async function loadVocabulary(sentence: Sentence | undefined): Promise<VocabularyEntry[]> {
  if (!sentence) return [];
  const entries = await Promise.all(sentence.vocabIds.map((id) => getVocabularyEntry(id)));
  return entries.filter((e): e is VocabularyEntry => e !== undefined);
}

/** Builds the per-mode puzzle for a card. Deterministic, so a reload shows the same one. */
function puzzlesFor(sentence: Sentence | undefined, mode: ImplementedMode) {
  if (!sentence) return { wordOrder: null, fillBlank: null, blankAnswers: [] };

  if (mode === "wordOrder") {
    return { wordOrder: createWordOrderPuzzle(sentence.th, "th"), fillBlank: null, blankAnswers: [] };
  }
  if (mode === "fillBlank") {
    const puzzle = createFillBlankPuzzle(sentence.en, "en");
    return { wordOrder: null, fillBlank: puzzle, blankAnswers: puzzle.blanks.map(() => "") };
  }
  return { wordOrder: null, fillBlank: null, blankAnswers: [] };
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
  mode: "dictation",
  cards: [],
  index: 0,
  vocabulary: [],
  cardStartedAt: 0,
  sessionXp: 0,
  cardsToday: 0,
  dailyGoal: 0,
  streak: 0,
  wordOrder: null,
  fillBlank: null,
  ...BLANK,

  start: async (category, mode) => {
    set({ phase: "loading", error: null, category, mode, sessionXp: 0, index: 0, ...BLANK });
    try {
      const now = Date.now();
      await seedDatabase();
      const settings = await loadSettings(now);
      const cards = await buildStudyQueue(category, settings, now, MODE_INFO[mode].direction);
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
        ...puzzlesFor(cards[0], mode),
        ...totals,
      });
    } catch (error) {
      set({ phase: "error", error: error instanceof Error ? error.message : String(error) });
    }
  },

  setAnswer: (value) => set({ answer: value }),

  placeToken: (token) => set((s) => ({ placed: [...s.placed, token] })),
  removeToken: (id) => set((s) => ({ placed: s.placed.filter((t) => t.id !== id) })),
  clearPlaced: () => set({ placed: [] }),

  setBlankAnswer: (index, value) =>
    set((s) => {
      const next = [...s.blankAnswers];
      next[index] = value;
      return { blankAnswers: next };
    }),

  setMicState: (micState) => set({ micState }),
  setMicFailure: (micFailure) => set({ micFailure, micState: micFailure ? "failed" : "idle" }),
  setTranscript: (transcript) => set({ transcript, answer: transcript }),

  showHint: () => set({ hintUsed: true }),
  markTtsUsed: () => set({ ttsUsed: true }),

  submit: async (options = {}) => {
    const state = get();
    const { cards, index, sessionId, mode, submitting, phase } = state;
    const sentence = cards[index];
    if (!sentence || !sessionId || submitting || phase !== "prompt") return;

    let userAnswer = state.answer;
    let scoring: ScoringOverride | undefined;
    let recordedAnswer: string | undefined;

    if (mode === "wordOrder") {
      if (!state.wordOrder || state.placed.length === 0) return;
      userAnswer = joinTokens(state.placed, "th");
    } else if (mode === "fillBlank") {
      if (!state.fillBlank) return;
      if (state.blankAnswers.every((v) => v.trim().length === 0)) return;
      const { expected, received } = scoreBlanks(state.fillBlank, state.blankAnswers);
      userAnswer = received;
      scoring = { expected, language: "en" };
      recordedAnswer = fillIn(state.fillBlank, state.blankAnswers);
    } else if (!options.force && userAnswer.trim().length === 0) {
      return;
    }

    // A transcript the learner says was misheard is graded against itself, so recognition
    // error cannot mark a correctly spoken sentence wrong.
    if (options.selfAssessedPass) {
      scoring = { expected: userAnswer, language: MODE_INFO[mode].answerLanguage };
    }

    set({ submitting: true });
    try {
      const outcome = await submitAnswer({
        sessionId,
        sentence,
        mode,
        direction: MODE_INFO[mode].direction,
        userAnswer,
        scoring,
        recordedAnswer,
        durationMs: Date.now() - state.cardStartedAt,
        hintUsed: state.hintUsed,
        ttsUsed: state.ttsUsed,
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

  /**
   * Grades a spoken answer by the learner's own judgement.
   *
   * A pass is scored against itself, so a transcript the learner says was misheard — or
   * an attempt with no transcript at all — cannot be marked wrong by recognition error.
   * This is the fallback for every failure case, and it is why a missing microphone
   * never blocks the mode.
   */
  selfAssess: async (pass) => {
    const { cards, index, mode } = get();
    const sentence = cards[index];
    if (!sentence) return;

    const target = MODE_INFO[mode].answerLanguage === "th" ? sentence.th : sentence.en;
    set({ phase: "prompt", answer: pass ? target : "" });
    await get().submit({ selfAssessedPass: pass, force: true });
  },

  retry: () =>
    set((s) => ({
      ...BLANK,
      phase: "prompt",
      cardStartedAt: Date.now(),
      ...puzzlesFor(s.cards[s.index], s.mode),
    })),

  skip: async () => {
    const { cards, index, sessionId, mode, cardStartedAt, submitting } = get();
    const sentence = cards[index];
    if (!sentence || !sessionId || submitting) return;

    set({ submitting: true });
    try {
      await skipCard({
        sessionId,
        sentence,
        mode,
        direction: MODE_INFO[mode].direction,
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
    const { cards, index, mode } = get();
    const nextIndex = index + 1;
    if (nextIndex >= cards.length) {
      set({ phase: "finished", wordOrder: null, fillBlank: null, ...BLANK });
      return;
    }
    set({
      index: nextIndex,
      phase: "prompt",
      cardStartedAt: Date.now(),
      vocabulary: await loadVocabulary(cards[nextIndex]),
      // BLANK first: it resets blankAnswers, which the puzzle then sizes to its blanks.
      ...BLANK,
      ...puzzlesFor(cards[nextIndex], mode),
    });
  },
}));
