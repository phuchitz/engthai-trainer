import type { MemoryLevel, SrsState } from "@/lib/models";
import { addLocalDays } from "./dates";
import type { Rating, Scheduler, SchedulingPatch, SchedulingState } from "./types";

/** Ease factor bounds. The upper bound matches the schema so a patch always validates. */
export const INITIAL_EASE = 2.5;
export const MIN_EASE = 1.3;
export const MAX_EASE = 3.5;

/** How much each rating moves the ease factor. */
export const EASE_DELTA: Record<Rating, number> = {
  again: -0.2,
  hard: -0.15,
  good: 0,
  easy: 0.15,
};

/** Fixed graduating steps, in days, for the first two successful reviews. */
export const FIRST_INTERVAL_DAYS = 1;
export const SECOND_INTERVAL_DAYS = 6;

/** A lapse drops the interval to zero, making the card due again the same day. */
export const LAPSE_INTERVAL_DAYS = 0;

/** Growth cap. Beyond a year the schedule stops being a useful recall signal. */
export const MAX_INTERVAL_DAYS = 365;

export const HARD_MULTIPLIER = 1.2;
export const EASY_BONUS = 1.3;

/** Interval thresholds, in days, for the learner-facing memory bands. */
export const MEMORY_THRESHOLDS = { familiar: 7, known: 21, mastered: 90 } as const;

export function clampEase(ease: number): number {
  return Math.min(MAX_EASE, Math.max(MIN_EASE, ease));
}

/**
 * Maps an answer-checking result onto a rating.
 *
 * Only an exact match counts as a clean pass. A near miss in the "great" band is still a
 * pass, but a reduced one — an English typo should not wipe out a streak. Below that the
 * learner produced a materially different sentence, so it is a lapse.
 *
 * Because Thai grading never reports anything but "perfect" or "tryAgain", a Thai answer
 * is only ever a clean pass or a clean lapse.
 */
export function ratingFromResult(result: { correct: boolean; band: string }): Rating {
  if (result.correct) return "good";
  return result.band === "great" ? "hard" : "again";
}

function nextEase(current: number, rating: Rating): number {
  return clampEase(current + EASE_DELTA[rating]);
}

/**
 * The interval for the next review, in whole calendar days.
 *
 *   again                       -> 0      (due again today)
 *   first success  (streak 0)   -> 1
 *   second success (streak 1)   -> 6
 *   later successes             -> round(previous * multiplier), capped at 365
 *
 *   multiplier = 1.2          when hard
 *              = ease         when good
 *              = ease * 1.3   when easy
 *
 * `streak` is the number of consecutive successes *before* this review, which is what
 * makes the two graduating steps fire in order.
 */
export function nextIntervalDays(state: SchedulingState, rating: Rating, ease: number): number {
  if (rating === "again") return LAPSE_INTERVAL_DAYS;
  if (state.consecutiveSuccesses === 0) return FIRST_INTERVAL_DAYS;
  if (state.consecutiveSuccesses === 1) return SECOND_INTERVAL_DAYS;

  // Guards against an imported record whose interval is smaller than its streak implies.
  const base = Math.max(state.intervalDays, SECOND_INTERVAL_DAYS);
  const multiplier = rating === "hard" ? HARD_MULTIPLIER : rating === "easy" ? ease * EASY_BONUS : ease;

  return Math.min(MAX_INTERVAL_DAYS, Math.round(base * multiplier));
}

export function memoryLevelFor(practiceCount: number, intervalDays: number): MemoryLevel {
  if (practiceCount === 0) return "new";
  if (intervalDays < MEMORY_THRESHOLDS.familiar) return "learning";
  if (intervalDays < MEMORY_THRESHOLDS.known) return "familiar";
  if (intervalDays < MEMORY_THRESHOLDS.mastered) return "known";
  return "mastered";
}

function nextState(rating: Rating, practiceCount: number, consecutiveSuccesses: number): SrsState {
  if (rating === "again") return practiceCount <= 1 ? "learning" : "relearning";
  return consecutiveSuccesses >= 2 ? "review" : "learning";
}

/**
 * A simplified SM-2.
 *
 * Differences from the 1987 original, and why:
 *
 * - Four ratings instead of a six-point quality scale. The extra resolution was never
 *   self-reportable and rarely changed the resulting schedule.
 * - Ease moves by a fixed step per rating rather than by SM-2's quadratic in q. Same
 *   direction, far easier to reason about and to test.
 * - Intervals are whole calendar days anchored to local midnight, so a card is due for
 *   the whole of its day regardless of what time it was answered.
 * - A lapse sets the interval to 0 rather than to 1, so a failed card comes back in the
 *   same session instead of tomorrow. Ease is penalised but the accumulated interval is
 *   what is actually lost.
 *
 * Deterministic by construction: it reads no clock and no random source.
 */
export const sm2Scheduler: Scheduler = {
  name: "sm2",

  review(state: SchedulingState, rating: Rating, reviewedAt: number): SchedulingPatch {
    const passed = rating !== "again";

    const ease = nextEase(state.ease, rating);
    const intervalDays = nextIntervalDays(state, rating, ease);

    const practiceCount = state.practiceCount + 1;
    const consecutiveSuccesses = passed ? state.consecutiveSuccesses + 1 : 0;

    return {
      practiceCount,
      correctCount: state.correctCount + (passed ? 1 : 0),
      incorrectCount: state.incorrectCount + (passed ? 0 : 1),
      consecutiveSuccesses,
      lastPracticedAt: reviewedAt,
      nextReviewAt: addLocalDays(reviewedAt, intervalDays),
      memoryLevel: memoryLevelFor(practiceCount, intervalDays),
      state: nextState(rating, practiceCount, consecutiveSuccesses),
      ease,
      intervalDays,
      reps: state.reps + 1,
      lapses: state.lapses + (passed ? 0 : 1),
      updatedAt: reviewedAt,
    };
  },
};
