import { describe, it, expect } from "vitest";
import {
  addLocalDays,
  buildMistakeQueue,
  countDue,
  countMistakes,
  filterDue,
  filterMistakes,
  isDue,
  isMistake,
  isNew,
  mistakeSeverity,
  startOfLocalDay,
  type SchedulingState,
} from "@/lib/srs";

const NOW = Date.parse("2026-09-21T15:00:00+07:00");

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

const clean = row("clean", { practiceCount: 5, correctCount: 5, nextReviewAt: addLocalDays(NOW, 3) });
const failedOnce = row("failed-once", { practiceCount: 4, correctCount: 3, incorrectCount: 1 });
const failedOften = row("failed-often", { practiceCount: 9, correctCount: 4, incorrectCount: 5, lapses: 5 });
const freshFailure = row("fresh-failure", { practiceCount: 1, incorrectCount: 1, lapses: 1 });
const untouched = row("untouched");

describe("isMistake", () => {
  it("is true once a card has been answered wrong", () => {
    expect(isMistake(failedOnce)).toBe(true);
  });

  it("is false for a card with a clean record", () => {
    expect(isMistake(clean)).toBe(false);
  });

  it("is false for a card never practised", () => {
    expect(isMistake(untouched)).toBe(false);
  });

  it("excludes suspended cards, like every other queue", () => {
    expect(isMistake({ ...failedOften, suspended: true })).toBe(false);
  });
});

describe("mistake queue is independent of the schedule", () => {
  it("includes a failed card that is not due for days", () => {
    const parked = row("parked", {
      practiceCount: 6,
      incorrectCount: 3,
      nextReviewAt: addLocalDays(NOW, 30),
    });
    expect(isDue(parked, NOW)).toBe(false);
    expect(isMistake(parked)).toBe(true);
  });

  it("excludes a due card that has never been failed", () => {
    const dueClean = row("due-clean", {
      practiceCount: 3,
      correctCount: 3,
      nextReviewAt: startOfLocalDay(NOW),
    });
    expect(isDue(dueClean, NOW)).toBe(true);
    expect(isMistake(dueClean)).toBe(false);
  });

  it("lets a card belong to both queues at once", () => {
    const both = row("both", {
      practiceCount: 4,
      incorrectCount: 2,
      nextReviewAt: startOfLocalDay(NOW),
    });
    expect(isDue(both, NOW)).toBe(true);
    expect(isMistake(both)).toBe(true);
  });

  it("counts the two queues separately, and they do not agree", () => {
    const parked = row("parked", {
      practiceCount: 6,
      incorrectCount: 3,
      nextReviewAt: addLocalDays(NOW, 30),
    });
    const all = [clean, failedOnce, failedOften, freshFailure, parked, untouched];

    // Four have been failed; only three of those are due, and `clean` is due-but-fine.
    expect(countMistakes(all)).toBe(4);
    expect(countDue(all, NOW)).toBe(3);

    expect(filterMistakes(all).map((r) => r.id)).toContain("parked");
    expect(filterDue(all, NOW).map((r) => r.id)).not.toContain("parked");
    expect(filterDue(all, NOW).map((r) => r.id)).not.toContain("untouched");
    expect(filterMistakes(all).map((r) => r.id)).not.toContain("clean");
  });

  it("never treats a mistake card as new", () => {
    for (const item of [failedOnce, failedOften, freshFailure]) {
      expect(isNew(item)).toBe(false);
    }
  });
});

describe("mistakeSeverity", () => {
  it("is zero for a card never failed", () => {
    expect(mistakeSeverity(clean)).toBe(0);
  });

  it("smooths tiny samples, so one failure out of one does not top the list", () => {
    // 1/(1+1) = 0.5 against 5/(9+1) = 0.5 … the tie-break then favours more failures.
    expect(mistakeSeverity(freshFailure)).toBeCloseTo(0.5, 10);
    expect(mistakeSeverity(failedOften)).toBeCloseTo(0.5, 10);
  });

  it("ranks a consistently failed card above an occasionally failed one", () => {
    const bad = row("bad", { practiceCount: 8, incorrectCount: 7 });
    const okay = row("okay", { practiceCount: 8, incorrectCount: 1 });
    expect(mistakeSeverity(bad)).toBeGreaterThan(mistakeSeverity(okay));
  });
});

describe("buildMistakeQueue", () => {
  const all = [clean, failedOnce, failedOften, freshFailure, untouched];

  it("contains only cards with mistakes", () => {
    expect(
      buildMistakeQueue(all)
        .map((r) => r.id)
        .sort(),
    ).toEqual(["failed-often", "failed-once", "fresh-failure"]);
  });

  it("puts the worst card first", () => {
    expect(buildMistakeQueue(all)[0].id).toBe("failed-often");
  });

  it("breaks a severity tie by total failures", () => {
    // Both score 0.5; the card failed five times should come first.
    const ranked = buildMistakeQueue([freshFailure, failedOften]);
    expect(ranked.map((r) => r.id)).toEqual(["failed-often", "fresh-failure"]);
  });

  it("honours a limit", () => {
    expect(buildMistakeQueue(all, { limit: 2 })).toHaveLength(2);
    expect(buildMistakeQueue(all, { limit: 0 })).toEqual([]);
  });

  it("returns nothing for a spotless library", () => {
    expect(buildMistakeQueue([clean, untouched])).toEqual([]);
  });

  it("does not mutate or reorder the caller's array", () => {
    const input = [...all];
    const snapshot = input.map((r) => r.id);
    buildMistakeQueue(input);
    expect(input.map((r) => r.id)).toEqual(snapshot);
  });

  it("is deterministic", () => {
    expect(buildMistakeQueue(all)).toEqual(buildMistakeQueue(all));
  });
});
