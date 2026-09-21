"use client";

import { create } from "zustand";
import type { Category, Settings, VocabularyEntry } from "@/lib/models";
import { seedDatabase } from "@/lib/db/seed";
import { loadSettings } from "@/lib/db/repositories/settings";
import { putSession } from "@/lib/db/repositories/sessions";
import { listAttemptsOnLocalDay } from "@/lib/db/repositories/attempts";
import { getVocabularyEntry } from "@/lib/db/repositories/vocabulary";
import {
  buildReviewQueue,
  buildStudyQueue,
  cardsCompletedToday,
  skipCard,
  submitAnswer,
  type ReviewKind,
  type ScoringOverride,
  type StudyCard,
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

/** What this session is working through, used to decide when to rebuild the queue. */
export type SessionSource =
  { kind: "lesson"; category: Category; mode: ImplementedMode } | { kind: "review"; review: ReviewKind };

export function sourceKey(source: SessionSource): string {
  return source.kind === "lesson" ? `lesson:${source.category}:${source.mode}` : `review:${source.review}`;
}

type StudyState = {
  phase: StudyPhase;
  error: string | null;

  sessionId: string | null;
  source: SessionSource | null;
  /**
   * Each card carries its own mode. A lesson session sets them all the same; a review
   * session mixes them, because the card's direction decides how it can be asked.
   */
  cards: StudyCard[];
  index: number;
  vocabulary: VocabularyEntry[];

  answer: string;
  hintUsed: boolean;
  ttsUsed: boolean;
  cardStartedAt: number;
  submitting: boolean;

  wordOrder: WordOrderPuzzle | null;
  placed: Token[];

  fillBlank: FillBlankPuzzle | null;
  blankAnswers: string[];

  micState: MicState;
  micFailure: RecognitionFailure | null;
  transcript: string | null;

  outcome: SubmitOutcome | null;
  sessionXp: number;
  cardsToday: number;
  dailyGoal: number;
  streak: number;

  startLesson: (category: Category, mode: ImplementedMode) => Promise<void>;
  startReview: (review: ReviewKind) => Promise<void>;
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

async function loadVocabulary(card: StudyCard | undefined): Promise<VocabularyEntry[]> {
  if (!card) return [];
  const entries = await Promise.all(card.sentence.vocabIds.map((id) => getVocabularyEntry(id)));
  return entries.filter((e): e is VocabularyEntry => e !== undefined);
}

/** Builds the per-mode puzzle for a card. Deterministic, so a reload shows the same one. */
function puzzlesFor(card: StudyCard | undefined) {
  if (!card) return { wordOrder: null, fillBlank: null, blankAnswers: [] };

  if (card.mode === "wordOrder") {
    return { wordOrder: createWordOrderPuzzle(card.sentence.th, "th"), fillBlank: null, blankAnswers: [] };
  }
  if (card.mode === "fillBlank") {
    const puzzle = createFillBlankPuzzle(card.sentence.en, "en");
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
  source: null,
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

  startLesson: async (category, mode) => {
    await begin({ kind: "lesson", category, mode }, set, (settings, now) =>
      buildStudyQueue(category, settings, now, MODE_INFO[mode].direction).then((sentences) =>
        sentences.map((sentence) => ({ sentence, mode })),
      ),
    );
  },

  startReview: async (review) => {
    await begin({ kind: "review", review }, set, (settings, now) => buildReviewQueue(review, settings, now));
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
    const { cards, index, sessionId, submitting, phase } = state;
    const card = cards[index];
    if (!card || !sessionId || submitting || phase !== "prompt") return;

    const { sentence, mode } = card;
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
   */
  selfAssess: async (pass) => {
    const { cards, index } = get();
    const card = cards[index];
    if (!card) return;

    const target = MODE_INFO[card.mode].answerLanguage === "th" ? card.sentence.th : card.sentence.en;
    set({ phase: "prompt", answer: pass ? target : "" });
    await get().submit({ selfAssessedPass: pass, force: true });
  },

  retry: () =>
    set((s) => ({
      ...BLANK,
      phase: "prompt",
      cardStartedAt: Date.now(),
      ...puzzlesFor(s.cards[s.index]),
    })),

  skip: async () => {
    const { cards, index, sessionId, cardStartedAt, submitting } = get();
    const card = cards[index];
    if (!card || !sessionId || submitting) return;

    set({ submitting: true });
    try {
      await skipCard({
        sessionId,
        sentence: card.sentence,
        mode: card.mode,
        direction: MODE_INFO[card.mode].direction,
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
      ...puzzlesFor(cards[nextIndex]),
    });
  },
}));

type SetState = (partial: Partial<StudyState>) => void;

/** Shared session start: both entry points differ only in how the queue is built. */
async function begin(
  source: SessionSource,
  set: SetState,
  buildCards: (settings: Settings, now: number) => Promise<StudyCard[]>,
): Promise<void> {
  set({ phase: "loading", error: null, source, sessionXp: 0, index: 0, ...BLANK });
  try {
    const now = Date.now();
    await seedDatabase();
    const settings = await loadSettings(now);
    const cards = await buildCards(settings, now);
    const totals = await readDailyTotals(settings, now);

    const sessionId = newId(now);
    await putSession({
      id: sessionId,
      kind: source.kind === "review" ? "review" : "lesson",
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
      ...puzzlesFor(cards[0]),
      ...totals,
    });
  } catch (error) {
    set({ phase: "error", error: error instanceof Error ? error.message : String(error) });
  }
}
