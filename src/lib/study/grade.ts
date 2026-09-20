import { checkAnswer, type Band, type CheckResult, type Language } from "@/lib/answer";
import { advanceStreak, xpForAnswer } from "@/lib/gamification";
import type { Attempt, Direction, ExerciseMode, Grade, Sentence, Verdict } from "@/lib/models";
import { defaultScheduler, ratingFromResult, type Rating } from "@/lib/srs";
import { addAttempt, listAttemptsOnLocalDay } from "@/lib/db/repositories/attempts";
import { getProgress, newProgress, putProgress } from "@/lib/db/repositories/progress";
import { loadSettings, saveSettings } from "@/lib/db/repositories/settings";
import { newId, progressId as makeProgressId } from "@/lib/utils/id";
import { cardsCompletedToday, shouldAwardXp, shouldSchedule } from "./policy";

/**
 * Dictation plays the English sentence and asks the learner to type it back, so the
 * skill it trains is producing English — the same card as translating from Thai.
 * Giving it its own direction would split one skill across two schedules.
 */
export const DICTATION_DIRECTION: Direction = "th2en";

const VERDICT_BY_BAND: Record<Band, Verdict> = {
  perfect: "correct",
  great: "close",
  good: "close",
  tryAgain: "incorrect",
};

const GRADE_BY_RATING: Record<Rating, Grade> = { again: 1, hard: 2, good: 3, easy: 4 };

/**
 * Replaces what the answer is graded against.
 *
 * Fill in the Blank uses this to compare only the removed words: grading the reassembled
 * sentence would flatter the learner, because the words that were never removed are
 * always right. The attempt log still records the full sentence as the expected answer.
 */
export type ScoringOverride = {
  expected: string;
  alternatives?: string[];
  language?: Language;
};

export type SubmitInput = {
  sessionId: string;
  sentence: Sentence;
  mode: ExerciseMode;
  direction?: Direction;
  userAnswer: string;
  durationMs: number;
  hintUsed: boolean;
  ttsUsed: boolean;
  scoring?: ScoringOverride;
  /** What to record in the log when it differs from `userAnswer`, e.g. a filled sentence. */
  recordedAnswer?: string;
  now?: number;
};

export type SubmitOutcome = {
  result: CheckResult;
  verdict: Verdict;
  rating: Rating;
  xpAwarded: number;
  /** False when XP was withheld because this card was already passed today. */
  xpWasNew: boolean;
  scheduled: boolean;
  nextReviewAt: number | null;
  streak: number;
  cardsCompletedToday: number;
};

function expectedFor(sentence: Sentence, direction: Direction) {
  return direction === "en2th"
    ? { text: sentence.th, alternatives: sentence.thAlternates, language: "th" as const }
    : { text: sentence.en, alternatives: sentence.enAlternates, language: "en" as const };
}

/**
 * Grades one answer and persists everything that follows from it.
 *
 * The three decisions that must not double-count on a refresh or a resubmission — XP,
 * the schedule move and the streak — are all derived from today's attempt log rather
 * than from anything held in memory, so replaying the same submission is a no-op.
 */
export async function submitAnswer(input: SubmitInput): Promise<SubmitOutcome> {
  const now = input.now ?? Date.now();
  const direction = input.direction ?? DICTATION_DIRECTION;
  const expected = expectedFor(input.sentence, direction);
  const id = makeProgressId("sentence", input.sentence.id, direction);

  const settings = await loadSettings(now);
  const target = input.scoring
    ? {
        text: input.scoring.expected,
        alternatives: input.scoring.alternatives ?? [],
        language: input.scoring.language ?? expected.language,
      }
    : expected;

  const result = checkAnswer(input.userAnswer, target.text, {
    language: target.language,
    alternatives: target.alternatives,
    ignoreCase: settings.ignoreCase,
    ignorePunctuation: settings.ignorePunctuation,
  });

  const rating = ratingFromResult(result);
  const verdict = VERDICT_BY_BAND[result.band];

  const todaysAttempts = await listAttemptsOnLocalDay(now);
  const awardXp = shouldAwardXp(todaysAttempts, id, now);
  const schedule = shouldSchedule(todaysAttempts, id, now);

  const earned = xpForAnswer({ band: result.band, hintUsed: input.hintUsed });
  const xpAwarded = awardXp ? earned : 0;

  const attempt: Attempt = {
    id: newId(now),
    sessionId: input.sessionId,
    progressId: id,
    itemType: "sentence",
    itemId: input.sentence.id,
    direction,
    mode: input.mode,
    prompt: direction === "en2th" ? input.sentence.en : input.sentence.th,
    userAnswer: input.recordedAnswer ?? input.userAnswer,
    expectedAnswer: expected.text,
    verdict,
    grade: GRADE_BY_RATING[rating],
    similarity: result.accuracy / 100,
    durationMs: input.durationMs,
    hintUsed: input.hintUsed,
    ttsUsed: input.ttsUsed,
    createdAt: now,
  };
  await addAttempt(attempt);

  let nextReviewAt: number | null = null;
  if (schedule) {
    const existing = (await getProgress(id)) ?? newProgress("sentence", input.sentence.id, direction, now);
    const patch = defaultScheduler.review(existing, rating, now);

    // Tracked here rather than in the scheduler: which mode an item is failed in is a
    // teaching signal, not a scheduling one.
    const mistakesByMode = { ...existing.mistakesByMode };
    if (rating === "again") mistakesByMode[input.mode] += 1;

    await putProgress({ ...existing, ...patch, mistakesByMode });
    nextReviewAt = patch.nextReviewAt;
  }

  let streak = settings.streak;
  if (xpAwarded > 0) {
    streak = advanceStreak(settings.streak, now);
    if (streak !== settings.streak) await saveSettings({ streak }, now);
  }

  return {
    result,
    verdict,
    rating,
    xpAwarded,
    xpWasNew: awardXp,
    scheduled: schedule,
    nextReviewAt,
    streak: streak.current,
    cardsCompletedToday: cardsCompletedToday([...todaysAttempts, attempt], now),
  };
}

export type SkipInput = {
  sessionId: string;
  sentence: Sentence;
  mode: ExerciseMode;
  direction?: Direction;
  durationMs: number;
  now?: number;
};

/**
 * Records a skip.
 *
 * A skip earns nothing and does not move the schedule, so the card stays due. It is
 * logged rather than ignored because "I kept skipping this one" is worth seeing.
 */
export async function skipCard(input: SkipInput): Promise<void> {
  const now = input.now ?? Date.now();
  const direction = input.direction ?? DICTATION_DIRECTION;
  const expected = expectedFor(input.sentence, direction);

  await addAttempt({
    id: newId(now),
    sessionId: input.sessionId,
    progressId: makeProgressId("sentence", input.sentence.id, direction),
    itemType: "sentence",
    itemId: input.sentence.id,
    direction,
    mode: input.mode,
    prompt: direction === "en2th" ? input.sentence.en : input.sentence.th,
    userAnswer: "",
    expectedAnswer: expected.text,
    verdict: "skipped",
    grade: 1,
    similarity: 0,
    durationMs: input.durationMs,
    hintUsed: false,
    ttsUsed: false,
    createdAt: now,
  });
}
