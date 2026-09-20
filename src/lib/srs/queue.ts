import { startOfLocalDay } from "./dates";
import type { SchedulingState } from "./types";

/**
 * Two states that must never be conflated.
 *
 * A **new** card has never been practised. It has no schedule to be late for, and it is
 * gated by the learner's daily new-card allowance.
 *
 * A **due** card has been practised and its scheduled calendar day has arrived or passed.
 * It is a promise the scheduler made and is not subject to the new-card allowance.
 *
 * Counting new cards as due would make the backlog look enormous on day one and would
 * let the new-card limit silently throttle genuine reviews.
 */

/** Never practised. Suspended cards are excluded: the learner has set them aside. */
export function isNew<T extends Pick<SchedulingState, "practiceCount" | "suspended">>(item: T): boolean {
  return !item.suspended && item.practiceCount === 0;
}

/**
 * Practised before, and scheduled for today or an earlier day.
 *
 * Compared by calendar day rather than by instant, so a card scheduled for today is due
 * from midnight rather than from the exact time of day it was last answered.
 */
export function isDue<T extends Pick<SchedulingState, "practiceCount" | "suspended" | "nextReviewAt">>(
  item: T,
  now: number,
): boolean {
  if (item.suspended || item.practiceCount === 0) return false;
  return startOfLocalDay(item.nextReviewAt) <= startOfLocalDay(now);
}

export function filterNew<T extends Pick<SchedulingState, "practiceCount" | "suspended">>(items: T[]): T[] {
  return items.filter((item) => isNew(item));
}

export function filterDue<T extends Pick<SchedulingState, "practiceCount" | "suspended" | "nextReviewAt">>(
  items: T[],
  now: number,
): T[] {
  return items.filter((item) => isDue(item, now));
}

export function countNew<T extends Pick<SchedulingState, "practiceCount" | "suspended">>(items: T[]): number {
  return filterNew(items).length;
}

export function countDue<T extends Pick<SchedulingState, "practiceCount" | "suspended" | "nextReviewAt">>(
  items: T[],
  now: number,
): number {
  return filterDue(items, now).length;
}

export type QueueOptions = {
  now: number;
  /** Daily allowance for cards never practised before. */
  newLimit?: number;
  /** Daily cap on reviews, so a long absence does not produce an unusable backlog. */
  reviewLimit?: number;
};

export type Queue<T> = {
  due: T[];
  fresh: T[];
  /** Reviews first: they are already overdue, and new cards add to tomorrow's load. */
  combined: T[];
  totalDue: number;
  totalNew: number;
};

/**
 * Splits a set of progress rows into the work for one session.
 *
 * Longest-overdue cards come first so the backlog drains oldest-first. The totals report
 * what exists before the caps are applied, so the UI can say "50 due, showing 20".
 */
export function buildQueue<T extends Pick<SchedulingState, "practiceCount" | "suspended" | "nextReviewAt">>(
  items: T[],
  options: QueueOptions,
): Queue<T> {
  const { now, newLimit, reviewLimit } = options;

  const allDue = filterDue(items, now).sort((a, b) => a.nextReviewAt - b.nextReviewAt);
  const allNew = filterNew(items);

  const due = typeof reviewLimit === "number" ? allDue.slice(0, Math.max(0, reviewLimit)) : allDue;
  const fresh = typeof newLimit === "number" ? allNew.slice(0, Math.max(0, newLimit)) : allNew;

  return {
    due,
    fresh,
    combined: [...due, ...fresh],
    totalDue: allDue.length,
    totalNew: allNew.length,
  };
}
