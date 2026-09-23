import type { Attempt } from "@/lib/models";
import { isSameLocalDay } from "@/lib/srs";
import { modeSchedules } from "@/lib/exercises";

/** The slice of an attempt these decisions need. */
export type PriorAttempt = Pick<Attempt, "progressId" | "verdict" | "createdAt" | "mode">;

/** Verdicts that count as having passed the card. */
const PASSING_VERDICTS = new Set(["correct", "close"]);

export function isPass(verdict: Attempt["verdict"]): boolean {
  return PASSING_VERDICTS.has(verdict);
}

/** Attempts on this card earlier in the same local day. A reload does not reset this. */
export function attemptsTodayFor(attempts: PriorAttempt[], progressId: string, now: number): PriorAttempt[] {
  return attempts.filter((a) => a.progressId === progressId && isSameLocalDay(a.createdAt, now));
}

/**
 * XP is paid once per card per local calendar day, for the first passing answer.
 *
 * Deriving this from the append-only attempt log rather than a flag on the progress row
 * is what makes it survive a refresh, a resubmission and a second browser tab: there is
 * no in-memory "already awarded" state to lose, and re-asking the question always gives
 * the same answer.
 */
export function shouldAwardXp(attempts: PriorAttempt[], progressId: string, now: number): boolean {
  return !attemptsTodayFor(attempts, progressId, now).some((a) => isPass(a.verdict));
}

/**
 * The schedule moves on the first *graded* answer of the day for a card — pass or fail.
 *
 * Retrying after a wrong answer records the attempt but does not reschedule, so drilling
 * a card until it is right cannot be used to buy a longer interval. Skips are not graded
 * at all, so they never move the schedule.
 *
 * An attempt in a practice-only mode is ignored here as well. It never moved the
 * schedule itself, so letting it consume the day's move would mean a round of Multiple
 * Choice silently stopped the card being scheduled by the typed answer that followed —
 * a practice mode that quietly costs the learner a review.
 */
export function shouldSchedule(attempts: PriorAttempt[], progressId: string, now: number): boolean {
  return !attemptsTodayFor(attempts, progressId, now).some(
    (a) => a.verdict !== "skipped" && modeSchedules(a.mode),
  );
}

/** Cards passed today, for the daily-goal ring. Distinct cards, not attempts. */
export function cardsCompletedToday(attempts: PriorAttempt[], now: number): number {
  const passed = new Set<string>();
  for (const attempt of attempts) {
    if (isPass(attempt.verdict) && isSameLocalDay(attempt.createdAt, now)) passed.add(attempt.progressId);
  }
  return passed.size;
}
