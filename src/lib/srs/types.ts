import type { SentenceProgress } from "@/lib/models";

/**
 * How well the learner recalled the item. Four ratings rather than SM-2's original
 * six-point quality scale, because a learner cannot meaningfully self-report six levels
 * and the extra resolution never changed the schedule much.
 */
export const RATINGS = ["again", "hard", "good", "easy"] as const;
export type Rating = (typeof RATINGS)[number];

/** The fields the scheduler reads. A narrow slice, so the module stays independent of storage. */
export type SchedulingState = Pick<
  SentenceProgress,
  | "practiceCount"
  | "correctCount"
  | "incorrectCount"
  | "consecutiveSuccesses"
  | "intervalDays"
  | "ease"
  | "reps"
  | "lapses"
  | "suspended"
  | "nextReviewAt"
>;

/** The fields the scheduler writes. Merged onto the stored record by the caller. */
export type SchedulingPatch = Pick<
  SentenceProgress,
  | "practiceCount"
  | "correctCount"
  | "incorrectCount"
  | "consecutiveSuccesses"
  | "lastPracticedAt"
  | "nextReviewAt"
  | "memoryLevel"
  | "state"
  | "ease"
  | "intervalDays"
  | "reps"
  | "lapses"
  | "updatedAt"
>;

export interface Scheduler {
  readonly name: string;
  /**
   * Pure: the same state, rating and timestamp always produce the same patch.
   * `reviewedAt` is passed in rather than read from the clock so it stays testable.
   */
  review(state: SchedulingState, rating: Rating, reviewedAt: number): SchedulingPatch;
}
