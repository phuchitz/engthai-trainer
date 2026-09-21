import type { Attempt } from "@/lib/models";
import { isSameLocalDay } from "@/lib/srs";
// Imported from the module rather than the barrel: the barrel re-exports repository
// code, and this file must stay free of the database layer.
import { isPass } from "@/lib/study/policy";

export type ScoredAttempt = Pick<Attempt, "verdict" | "createdAt">;

export type Accuracy = {
  /** Attempts that were actually graded. Skips are not answers and are excluded. */
  graded: number;
  passed: number;
  /** 0–100, rounded. Zero graded attempts reports 0 rather than NaN. */
  percent: number;
};

/**
 * Accuracy = passing attempts / graded attempts.
 *
 * Counts **every graded attempt**, not just the first of each card. Retrying a card until
 * it is right therefore lowers accuracy, which is the honest reading: the figure measures
 * how often answers are right, not whether the learner eventually got there.
 *
 * "Passing" matches the XP and streak rules exactly — an exact answer or a near miss.
 * Skips are excluded entirely, because declining to answer is not a wrong answer.
 */
export function accuracyOf(attempts: readonly ScoredAttempt[]): Accuracy {
  let graded = 0;
  let passed = 0;

  for (const attempt of attempts) {
    if (attempt.verdict === "skipped") continue;
    graded += 1;
    if (isPass(attempt.verdict)) passed += 1;
  }

  return { graded, passed, percent: graded === 0 ? 0 : Math.round((passed / graded) * 100) };
}

export function accuracyOnLocalDay(attempts: readonly ScoredAttempt[], now: number): Accuracy {
  return accuracyOf(attempts.filter((a) => isSameLocalDay(a.createdAt, now)));
}

export type CountedAttempt = Pick<Attempt, "itemType" | "itemId" | "verdict" | "createdAt">;

/**
 * Distinct **sentences** passed today, which is what the daily goal counts.
 *
 * Deliberately not the same as cards passed: a sentence has a card per direction, and
 * practising both would otherwise tick the goal twice for one sentence.
 */
export function sentencesCompletedToday(attempts: readonly CountedAttempt[], now: number): number {
  const passed = new Set<string>();
  for (const attempt of attempts) {
    if (attempt.itemType !== "sentence") continue;
    if (!isPass(attempt.verdict)) continue;
    if (!isSameLocalDay(attempt.createdAt, now)) continue;
    passed.add(attempt.itemId);
  }
  return passed.size;
}

/** Distinct sentences ever passed, for the achievement thresholds. */
export function sentencesCompletedEver(attempts: readonly CountedAttempt[]): number {
  const passed = new Set<string>();
  for (const attempt of attempts) {
    if (attempt.itemType === "sentence" && isPass(attempt.verdict)) passed.add(attempt.itemId);
  }
  return passed.size;
}
