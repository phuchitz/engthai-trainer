import { describe, it, expect } from "vitest";
import {
  addLocalDays,
  buildQueue,
  countDue,
  countNew,
  filterDue,
  filterNew,
  isDue,
  isNew,
  startOfLocalDay,
  type SchedulingState,
} from "@/lib/srs";

const NOW = Date.parse("2026-09-20T15:42:07+07:00");

type Row = SchedulingState & { id: string };

function row(id: string, over: Partial<SchedulingState> = {}): Row {
  return {
    id,
    practiceCount: 0,
    correctCount: 0,
    incorrectCount: 0,
    consecutiveSuccesses: 0,
    intervalDays: 0,
    ease: 2.5,
    reps: 0,
    lapses: 0,
    suspended: false,
    nextReviewAt: NOW,
    ...over,
  };
}

const neverPractised = row("fresh");
const dueToday = row("due-today", { practiceCount: 3, nextReviewAt: startOfLocalDay(NOW) });
const overdue = row("overdue", { practiceCount: 3, nextReviewAt: addLocalDays(NOW, -9) });
const future = row("future", { practiceCount: 3, nextReviewAt: addLocalDays(NOW, 4) });

describe("isNew", () => {
  it("is true only when the card has never been practised", () => {
    expect(isNew(neverPractised)).toBe(true);
    expect(isNew(dueToday)).toBe(false);
  });

  it("excludes suspended cards", () => {
    expect(isNew(row("s", { suspended: true }))).toBe(false);
  });

  it("does not depend on the scheduled time", () => {
    expect(isNew(row("f", { nextReviewAt: addLocalDays(NOW, 30) }))).toBe(true);
  });
});

describe("isDue", () => {
  it("is true for a card scheduled today", () => {
    expect(isDue(dueToday, NOW)).toBe(true);
  });

  it("is true for an overdue card", () => {
    expect(isDue(overdue, NOW)).toBe(true);
  });

  it("is false for a card scheduled in the future", () => {
    expect(isDue(future, NOW)).toBe(false);
  });

  it("is false for a card that has never been practised", () => {
    expect(isDue(neverPractised, NOW)).toBe(false);
  });

  it("excludes suspended cards", () => {
    expect(isDue({ ...dueToday, suspended: true }, NOW)).toBe(false);
  });

  it("treats the whole calendar day as due, not the exact instant", () => {
    // Scheduled for late today; still due when checked first thing this morning.
    const lateToday = row("late", {
      practiceCount: 2,
      nextReviewAt: Date.parse("2026-09-20T23:30:00+07:00"),
    });
    expect(isDue(lateToday, Date.parse("2026-09-20T00:05:00+07:00"))).toBe(true);
  });

  it("becomes due exactly at local midnight, not 24 hours after the review", () => {
    const tomorrow = row("t", { practiceCount: 2, nextReviewAt: addLocalDays(NOW, 1) });
    expect(isDue(tomorrow, Date.parse("2026-09-20T23:59:59+07:00"))).toBe(false);
    expect(isDue(tomorrow, Date.parse("2026-09-21T00:00:01+07:00"))).toBe(true);
  });
});

describe("new and due are disjoint", () => {
  const all = [neverPractised, dueToday, overdue, future];

  it("never classifies the same card as both", () => {
    for (const item of all) expect(isNew(item) && isDue(item, NOW)).toBe(false);
  });

  it("counts them separately", () => {
    expect(countNew(all)).toBe(1);
    expect(countDue(all, NOW)).toBe(2);
  });

  it("filters them separately", () => {
    expect(filterNew(all).map((r) => r.id)).toEqual(["fresh"]);
    expect(
      filterDue(all, NOW)
        .map((r) => r.id)
        .sort(),
    ).toEqual(["due-today", "overdue"]);
  });

  it("leaves a future card out of both", () => {
    expect(isNew(future)).toBe(false);
    expect(isDue(future, NOW)).toBe(false);
  });
});

describe("buildQueue", () => {
  const all = [future, neverPractised, dueToday, overdue];

  it("puts the longest-overdue card first", () => {
    expect(buildQueue(all, { now: NOW }).due.map((r) => r.id)).toEqual(["overdue", "due-today"]);
  });

  it("puts reviews before new cards", () => {
    expect(buildQueue(all, { now: NOW }).combined.map((r) => r.id)).toEqual([
      "overdue",
      "due-today",
      "fresh",
    ]);
  });

  it("applies the new-card allowance without touching reviews", () => {
    const queue = buildQueue([...all, row("fresh2"), row("fresh3")], { now: NOW, newLimit: 1 });
    expect(queue.fresh).toHaveLength(1);
    expect(queue.due).toHaveLength(2);
  });

  it("applies the review cap", () => {
    const queue = buildQueue(all, { now: NOW, reviewLimit: 1 });
    expect(queue.due.map((r) => r.id)).toEqual(["overdue"]);
  });

  it("reports the totals before the caps, so the UI can say how many were held back", () => {
    const queue = buildQueue([...all, row("fresh2")], { now: NOW, newLimit: 1, reviewLimit: 1 });
    expect(queue.totalDue).toBe(2);
    expect(queue.totalNew).toBe(2);
    expect(queue.due).toHaveLength(1);
    expect(queue.fresh).toHaveLength(1);
  });

  it("treats a zero limit as excluding that category entirely", () => {
    const queue = buildQueue(all, { now: NOW, newLimit: 0, reviewLimit: 0 });
    expect(queue.combined).toEqual([]);
    expect(queue.totalDue).toBe(2);
  });

  it("returns empty lists for an empty library", () => {
    const queue = buildQueue([], { now: NOW });
    expect(queue.combined).toEqual([]);
    expect(queue.totalDue).toBe(0);
    expect(queue.totalNew).toBe(0);
  });

  it("does not mutate or reorder the caller's array", () => {
    const input = [...all];
    const snapshot = input.map((r) => r.id);
    buildQueue(input, { now: NOW });
    expect(input.map((r) => r.id)).toEqual(snapshot);
  });

  it("is deterministic", () => {
    const a = buildQueue(all, { now: NOW, newLimit: 2, reviewLimit: 2 });
    const b = buildQueue(all, { now: NOW, newLimit: 2, reviewLimit: 2 });
    expect(a).toEqual(b);
  });
});
