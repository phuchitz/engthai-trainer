"use client";

import { create } from "zustand";
import type { Category, Settings, VocabularyEntry } from "@/lib/models";
import { seedDatabase } from "@/lib/db/seed";
import { loadSettings } from "@/lib/db/repositories/settings";
import { putSession } from "@/lib/db/repositories/sessions";
import { listAttemptsOnLocalDay } from "@/lib/db/repositories/attempts";
import { getVocabularyEntry } from "@/lib/db/repositories/vocabulary";
import { listSentences } from "@/lib/db/repositories/sentences";
import {
  buildReviewQueue,
  buildStudyQueue,
  loadDashboard,
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
  createMultipleChoicePuzzle,
  createWordOrderPuzzle,
  chosenText,
  OPTION_COUNT,
  fillIn,
  joinTokens,
  scoreBlanks,
  MODE_INFO,
  type FillBlankPuzzle,
  type ImplementedMode,
  type MultipleChoicePuzzle,
  type Token,
  type WordOrderPuzzle,
} from "@/lib/exercises";
import {
  currentStreak,
  newlyUnlocked,
  StudyTimer,
  type Achievement,
  type AchievementStats,
} from "@/lib/gamification";
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

export type SessionSummary = {
  answered: number;
  passed: number;
  skipped: number;
  xp: number;
  activeMs: number;
  accuracyPercent: number;
  unlocked: Achievement[];
};

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
  /** Per-card active-time tracker: background and idle stretches are not counted. */
  timer: StudyTimer | null;
  submitting: boolean;

  wordOrder: WordOrderPuzzle | null;
  placed: Token[];

  fillBlank: FillBlankPuzzle | null;
  blankAnswers: string[];

  multipleChoice: MultipleChoicePuzzle | null;
  choice: number | null;
  /**
   * Sentences the Multiple Choice distractors are drawn from — the learner's own
   * library, because the app never invents a wrong answer to pad a question out.
   */
  choicePool: ChoiceSource[];

  micState: MicState;
  micFailure: RecognitionFailure | null;
  transcript: string | null;

  outcome: SubmitOutcome | null;
  sessionXp: number;
  sessionAnswered: number;
  sessionPassed: number;
  sessionSkipped: number;
  sessionActiveMs: number;
  statsAtStart: AchievementStats | null;
  summary: SessionSummary | null;
  cardsToday: number;
  dailyGoal: number;
  streak: number;

  startLesson: (category: Category, mode: ImplementedMode) => Promise<void>;
  startReview: (review: ReviewKind) => Promise<void>;
  setAnswer: (value: string) => void;
  /** Any sign of life; keeps the active-time clock running. */
  markActivity: () => void;
  setHidden: (hidden: boolean) => void;
  placeToken: (token: Token) => void;
  removeToken: (id: string) => void;
  clearPlaced: () => void;
  setBlankAnswer: (index: number, value: string) => void;
  setChoice: (index: number) => void;
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
  timer: null as StudyTimer | null,
  placed: [] as Token[],
  blankAnswers: [] as string[],
  choice: null as number | null,
  micState: "idle" as MicState,
  micFailure: null as RecognitionFailure | null,
  transcript: null as string | null,
};

async function loadVocabulary(card: StudyCard | undefined): Promise<VocabularyEntry[]> {
  if (!card) return [];
  const entries = await Promise.all(card.sentence.vocabIds.map((id) => getVocabularyEntry(id)));
  return entries.filter((e): e is VocabularyEntry => e !== undefined);
}

/** A sentence that could serve as a distractor, with what is needed to choose it. */
type ChoiceSource = { id: string; en: string; category: Category };

const NO_PUZZLES = { wordOrder: null, fillBlank: null, blankAnswers: [], multipleChoice: null };

/**
 * Which sentences may stand in as wrong answers for this card.
 *
 * Same category when the category can supply enough, because a distractor from another
 * topic can be ruled out without reading the Thai at all — "Let's take that offline" is
 * obviously not the answer to a question about being hungry. Only when a category is too
 * thin does the rest of the library fill in, which is better than asking no question.
 */
function distractorsFor(card: StudyCard, pool: readonly ChoiceSource[]): string[] {
  const others = pool.filter((s) => s.id !== card.sentence.id);
  const sameTopic = others.filter((s) => s.category === card.sentence.category);
  return (sameTopic.length >= OPTION_COUNT - 1 ? sameTopic : others).map((s) => s.en);
}

/** Builds the per-mode puzzle for a card. Deterministic, so a reload shows the same one. */
function puzzlesFor(card: StudyCard | undefined, pool: readonly ChoiceSource[] = []) {
  if (!card) return NO_PUZZLES;

  if (card.mode === "wordOrder") {
    return { ...NO_PUZZLES, wordOrder: createWordOrderPuzzle(card.sentence.th, "th") };
  }
  if (card.mode === "fillBlank") {
    const puzzle = createFillBlankPuzzle(card.sentence.en, "en");
    return { ...NO_PUZZLES, fillBlank: puzzle, blankAnswers: puzzle.blanks.map(() => "") };
  }
  if (card.mode === "multipleChoice") {
    // Null when the library is too small to offer real alternatives; the screen says so.
    return {
      ...NO_PUZZLES,
      multipleChoice: createMultipleChoicePuzzle(card.sentence.en, distractorsFor(card, pool)),
    };
  }
  return NO_PUZZLES;
}

/** The whole library, loaded once, for Multiple Choice to draw its distractors from. */
async function loadChoicePool(cards: StudyCard[]): Promise<ChoiceSource[]> {
  if (!cards.some((card) => card.mode === "multipleChoice")) return [];
  return (await listSentences()).map((s) => ({ id: s.id, en: s.en, category: s.category }));
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
  sessionXp: 0,
  sessionAnswered: 0,
  sessionPassed: 0,
  sessionSkipped: 0,
  sessionActiveMs: 0,
  statsAtStart: null,
  summary: null,
  cardsToday: 0,
  dailyGoal: 0,
  streak: 0,
  wordOrder: null,
  fillBlank: null,
  multipleChoice: null,
  choicePool: [],
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

  setAnswer: (value) => {
    get().timer?.mark("activity");
    set({ answer: value });
  },

  markActivity: () => get().timer?.mark("activity"),
  setHidden: (hidden) => get().timer?.mark(hidden ? "hidden" : "visible"),

  placeToken: (token) => set((s) => ({ placed: [...s.placed, token] })),
  removeToken: (id) => set((s) => ({ placed: s.placed.filter((t) => t.id !== id) })),
  clearPlaced: () => set({ placed: [] }),

  setBlankAnswer: (index, value) =>
    set((s) => {
      const next = [...s.blankAnswers];
      next[index] = value;
      return { blankAnswers: next };
    }),

  setChoice: (choice) => {
    get().timer?.mark("activity");
    set({ choice });
  },

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
    } else if (mode === "multipleChoice") {
      if (!state.multipleChoice || state.choice === null) return;
      userAnswer = chosenText(state.multipleChoice, state.choice);
      // Distractors are real sentences a word or two from the answer, so partial credit
      // would report a comfortable score for a question that was simply got wrong.
      scoring = { expected: sentence.en, alternatives: sentence.enAlternates, exactOnly: true };
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
        // Active time only: the timer has already discounted background and idle.
        durationMs: state.timer?.stop() ?? 0,
        hintUsed: state.hintUsed,
        ttsUsed: state.ttsUsed,
      });
      const passed = outcome.verdict === "correct" || outcome.verdict === "close";
      set((s) => ({
        outcome,
        phase: "graded",
        submitting: false,
        sessionXp: s.sessionXp + outcome.xpAwarded,
        sessionAnswered: s.sessionAnswered + 1,
        sessionPassed: s.sessionPassed + (passed ? 1 : 0),
        sessionActiveMs: s.sessionActiveMs + (state.timer?.elapsed() ?? 0),
        cardsToday: outcome.sentencesCompletedToday,
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
      timer: new StudyTimer(),
      ...puzzlesFor(s.cards[s.index], s.choicePool),
    })),

  skip: async () => {
    const { cards, index, sessionId, timer, submitting } = get();
    const card = cards[index];
    if (!card || !sessionId || submitting) return;

    set({ submitting: true });
    try {
      await skipCard({
        sessionId,
        sentence: card.sentence,
        mode: card.mode,
        direction: MODE_INFO[card.mode].direction,
        durationMs: timer?.stop() ?? 0,
      });
      set((s) => ({ submitting: false, sessionSkipped: s.sessionSkipped + 1 }));
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
      set({ phase: "finished", wordOrder: null, fillBlank: null, multipleChoice: null, ...BLANK });
      await finish(set, get);
      return;
    }
    set({
      index: nextIndex,
      phase: "prompt",
      vocabulary: await loadVocabulary(cards[nextIndex]),
      // BLANK first: it clears blankAnswers and the timer, which the two lines below
      // then replace with the values for the new card.
      ...BLANK,
      ...puzzlesFor(cards[nextIndex], get().choicePool),
      timer: new StudyTimer(),
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
  set({
    phase: "loading",
    error: null,
    source,
    sessionXp: 0,
    sessionAnswered: 0,
    sessionPassed: 0,
    sessionSkipped: 0,
    sessionActiveMs: 0,
    summary: null,
    index: 0,
    ...BLANK,
  });
  try {
    const now = Date.now();
    await seedDatabase();
    const settings = await loadSettings(now);
    const cards = await buildCards(settings, now);
    const totals = await readDailyTotals(settings, now);

    const choicePool = await loadChoicePool(cards);

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

    const before = await loadDashboard(now);

    set({
      statsAtStart: before.stats,
      sessionId,
      cards,
      vocabulary: await loadVocabulary(cards[0]),
      phase: cards.length === 0 ? "finished" : "prompt",
      timer: new StudyTimer(now),
      choicePool,
      ...puzzlesFor(cards[0], choicePool),
      ...totals,
    });
  } catch (error) {
    set({ phase: "error", error: error instanceof Error ? error.message : String(error) });
  }
}

type GetState = () => StudyState;

/**
 * Builds the end-of-session summary.
 *
 * Achievements are compared against the snapshot taken when the session started, so the
 * summary reports what *this* session unlocked rather than everything already earned.
 */
async function finish(set: SetState, get: GetState): Promise<void> {
  const { sessionAnswered, sessionPassed, sessionSkipped, sessionXp, sessionActiveMs, statsAtStart } = get();

  try {
    const after = await loadDashboard();
    set({
      summary: {
        answered: sessionAnswered,
        passed: sessionPassed,
        skipped: sessionSkipped,
        xp: sessionXp,
        activeMs: sessionActiveMs,
        accuracyPercent: sessionAnswered === 0 ? 0 : Math.round((sessionPassed / sessionAnswered) * 100),
        unlocked: statsAtStart ? newlyUnlocked(statsAtStart, after.stats) : [],
      },
    });
  } catch {
    // A summary is a nicety; failing to build one must not break the finished screen.
  }
}
