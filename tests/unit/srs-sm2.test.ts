import { describe, it, expect } from "vitest";
import {
  EASY_BONUS,
  FIRST_INTERVAL_DAYS,
  HARD_MULTIPLIER,
  INITIAL_EASE,
  MAX_EASE,
  MAX_INTERVAL_DAYS,
  MIN_EASE,
  SECOND_INTERVAL_DAYS,
  addLocalDays,
  clampEase,
  localDateKey,
  memoryLevelFor,
  ratingFromResult,
  sm2Scheduler,
  startOfLocalDay,
  type Rating,
  type SchedulingState,
} from "@/lib/srs";

const REVIEWED_AT = Date.parse("2026-09-20T15:42:07+07:00");

function state(over: Partial<SchedulingState> = {}): SchedulingState {
  return {
    practiceCount: 0,
    correctCount: 0,
    incorrectCount: 0,
    consecutiveSuccesses: 0,
    intervalDays: 0,
    ease: INITIAL_EASE,
    reps: 0,
    lapses: 0,
    suspended: false,
    nextReviewAt: REVIEWED_AT,
    ...over,
  };
}

/** Plays a sequence of ratings and returns the state after each one. */
function play(ratings: Rating[], initial = state(), startAt = REVIEWED_AT) {
  let current = initial;
  let at = startAt;
  const history = [];
  for (const rating of ratings) {
    const patch = sm2Scheduler.review(current, rating, at);
    history.push(patch);
    current = { ...current, ...patch };
    at = patch.nextReviewAt;
  }
  return { history, final: current };
}

describe("first review", () => {
  it("schedules a first success one day out", () => {
    const patch = sm2Scheduler.review(state(), "good", REVIEWED_AT);
    expect(patch.intervalDays).toBe(FIRST_INTERVAL_DAYS);
    expect(patch.nextReviewAt).toBe(addLocalDays(REVIEWED_AT, 1));
    expect(localDateKey(patch.nextReviewAt)).toBe("2026-09-21");
  });

  it("records the first success in the counters", () => {
    const patch = sm2Scheduler.review(state(), "good", REVIEWED_AT);
    expect(patch.practiceCount).toBe(1);
    expect(patch.correctCount).toBe(1);
    expect(patch.incorrectCount).toBe(0);
    expect(patch.consecutiveSuccesses).toBe(1);
    expect(patch.reps).toBe(1);
    expect(patch.lapses).toBe(0);
    expect(patch.lastPracticedAt).toBe(REVIEWED_AT);
  });

  it("leaves the item due today after a first failure", () => {
    const patch = sm2Scheduler.review(state(), "again", REVIEWED_AT);
    expect(patch.intervalDays).toBe(0);
    expect(patch.nextReviewAt).toBe(startOfLocalDay(REVIEWED_AT));
    expect(patch.nextReviewAt).toBeLessThanOrEqual(REVIEWED_AT);
  });

  it("counts a first failure without pretending it was never practised", () => {
    const patch = sm2Scheduler.review(state(), "again", REVIEWED_AT);
    expect(patch.practiceCount).toBe(1);
    expect(patch.incorrectCount).toBe(1);
    expect(patch.consecutiveSuccesses).toBe(0);
    expect(patch.lapses).toBe(1);
    expect(patch.state).toBe("learning");
  });
});

describe("streak growth", () => {
  it("follows the graduating steps 1 then 6 days", () => {
    const { history } = play(["good", "good"]);
    expect(history.map((p) => p.intervalDays)).toEqual([1, 6]);
  });

  it("multiplies by the ease factor from the third success", () => {
    const { history } = play(["good", "good", "good"]);
    expect(history[2].intervalDays).toBe(Math.round(SECOND_INTERVAL_DAYS * INITIAL_EASE));
    expect(history[2].intervalDays).toBe(15);
  });

  it("keeps extending across a long streak", () => {
    const { history } = play(Array<Rating>(6).fill("good"));
    const intervals = history.map((p) => p.intervalDays);
    expect(intervals).toEqual([1, 6, 15, 38, 95, 238]);
    for (let i = 1; i < intervals.length; i++) expect(intervals[i]).toBeGreaterThan(intervals[i - 1]);
  });

  it("increments consecutive successes each time", () => {
    const { history } = play(Array<Rating>(4).fill("good"));
    expect(history.map((p) => p.consecutiveSuccesses)).toEqual([1, 2, 3, 4]);
  });

  it("schedules each review relative to the day it was answered", () => {
    const { history } = play(["good", "good"]);
    expect(localDateKey(history[0].nextReviewAt)).toBe("2026-09-21");
    // Answered on the 21st, six days later is the 27th.
    expect(localDateKey(history[1].nextReviewAt)).toBe("2026-09-27");
  });
});

describe("failure resets the streak", () => {
  it("drops consecutive successes to zero", () => {
    const { history } = play(["good", "good", "good", "again"]);
    expect(history[2].consecutiveSuccesses).toBe(3);
    expect(history[3].consecutiveSuccesses).toBe(0);
  });

  it("makes a long-interval card due again the same day", () => {
    const established = state({ practiceCount: 9, consecutiveSuccesses: 5, intervalDays: 120 });
    const patch = sm2Scheduler.review(established, "again", REVIEWED_AT);
    expect(patch.intervalDays).toBe(0);
    expect(patch.nextReviewAt).toBe(startOfLocalDay(REVIEWED_AT));
  });

  it("marks an established card as relearning rather than learning", () => {
    const established = state({ practiceCount: 9, consecutiveSuccesses: 5, intervalDays: 120 });
    expect(sm2Scheduler.review(established, "again", REVIEWED_AT).state).toBe("relearning");
  });

  it("restarts the graduating steps after a lapse", () => {
    const { history } = play(["good", "good", "good", "again", "good", "good"]);
    expect(history.slice(4).map((p) => p.intervalDays)).toEqual([1, 6]);
  });

  it("counts the lapse", () => {
    const { history } = play(["good", "again", "good", "again"]);
    expect(history.map((p) => p.lapses)).toEqual([0, 1, 1, 2]);
  });
});

describe("ease factor", () => {
  it("starts at 2.5 and is unchanged by a good answer", () => {
    expect(sm2Scheduler.review(state(), "good", REVIEWED_AT).ease).toBe(INITIAL_EASE);
  });

  it("falls on a failure and on a hard answer", () => {
    expect(sm2Scheduler.review(state(), "again", REVIEWED_AT).ease).toBeCloseTo(2.3, 10);
    expect(sm2Scheduler.review(state(), "hard", REVIEWED_AT).ease).toBeCloseTo(2.35, 10);
  });

  it("rises on an easy answer", () => {
    expect(sm2Scheduler.review(state(), "easy", REVIEWED_AT).ease).toBeCloseTo(2.65, 10);
  });

  it("never falls below the floor however many failures", () => {
    const { final } = play(Array<Rating>(30).fill("again"));
    expect(final.ease).toBe(MIN_EASE);
  });

  it("never rises above the ceiling the schema allows", () => {
    const { final } = play(Array<Rating>(30).fill("easy"));
    expect(final.ease).toBe(MAX_EASE);
    expect(final.ease).toBeLessThanOrEqual(MAX_EASE);
  });

  it("clamps directly too", () => {
    expect(clampEase(0)).toBe(MIN_EASE);
    expect(clampEase(99)).toBe(MAX_EASE);
    expect(clampEase(2.1)).toBe(2.1);
  });

  it("lets a lower ease produce shorter intervals", () => {
    const easy = play(["easy", "easy", "easy"]).final.intervalDays;
    const hard = play(["hard", "hard", "hard"]).final.intervalDays;
    expect(hard).toBeLessThan(easy);
  });
});

describe("rating multipliers", () => {
  const established = state({ practiceCount: 5, consecutiveSuccesses: 3, intervalDays: 20, ease: 2.5 });

  it("uses a fixed small multiplier for hard", () => {
    const patch = sm2Scheduler.review(established, "hard", REVIEWED_AT);
    expect(patch.intervalDays).toBe(Math.round(20 * HARD_MULTIPLIER));
  });

  it("uses the ease factor for good", () => {
    expect(sm2Scheduler.review(established, "good", REVIEWED_AT).intervalDays).toBe(Math.round(20 * 2.5));
  });

  it("adds a bonus for easy", () => {
    const patch = sm2Scheduler.review(established, "easy", REVIEWED_AT);
    expect(patch.intervalDays).toBe(Math.round(20 * clampEase(2.5 + 0.15) * EASY_BONUS));
    expect(patch.intervalDays).toBeGreaterThan(
      sm2Scheduler.review(established, "good", REVIEWED_AT).intervalDays,
    );
  });
});

describe("interval cap", () => {
  it("never exceeds the maximum", () => {
    const { final } = play(Array<Rating>(30).fill("easy"));
    expect(final.intervalDays).toBe(MAX_INTERVAL_DAYS);
  });

  it("holds at the cap rather than oscillating", () => {
    const atCap = state({ practiceCount: 20, consecutiveSuccesses: 10, intervalDays: MAX_INTERVAL_DAYS });
    expect(sm2Scheduler.review(atCap, "good", REVIEWED_AT).intervalDays).toBe(MAX_INTERVAL_DAYS);
  });

  it("caps a state imported with an absurd interval", () => {
    const wild = state({ practiceCount: 20, consecutiveSuccesses: 10, intervalDays: 100_000 });
    expect(sm2Scheduler.review(wild, "good", REVIEWED_AT).intervalDays).toBe(MAX_INTERVAL_DAYS);
  });

  it("repairs an interval smaller than the streak implies", () => {
    const inconsistent = state({ practiceCount: 5, consecutiveSuccesses: 4, intervalDays: 0 });
    expect(sm2Scheduler.review(inconsistent, "good", REVIEWED_AT).intervalDays).toBe(
      Math.round(SECOND_INTERVAL_DAYS * INITIAL_EASE),
    );
  });
});

describe("memory level", () => {
  it("is new only before the first practice", () => {
    expect(memoryLevelFor(0, 0)).toBe("new");
    expect(memoryLevelFor(1, 0)).toBe("learning");
  });

  it("moves through the bands as the interval grows", () => {
    expect(memoryLevelFor(3, 6)).toBe("learning");
    expect(memoryLevelFor(3, 7)).toBe("familiar");
    expect(memoryLevelFor(3, 20)).toBe("familiar");
    expect(memoryLevelFor(3, 21)).toBe("known");
    expect(memoryLevelFor(3, 89)).toBe("known");
    expect(memoryLevelFor(3, 90)).toBe("mastered");
  });

  it("falls back to learning after a lapse", () => {
    const established = state({ practiceCount: 9, consecutiveSuccesses: 5, intervalDays: 120 });
    expect(sm2Scheduler.review(established, "again", REVIEWED_AT).memoryLevel).toBe("learning");
  });

  it("climbs over a long successful streak", () => {
    const { history } = play(Array<Rating>(6).fill("good"));
    expect(history.map((p) => p.memoryLevel)).toEqual([
      "learning",
      "learning",
      "familiar",
      "known",
      "mastered",
      "mastered",
    ]);
  });
});

describe("srs state", () => {
  it("stays in learning until two successes in a row", () => {
    const { history } = play(["good", "good", "good"]);
    expect(history.map((p) => p.state)).toEqual(["learning", "review", "review"]);
  });
});

describe("ratingFromResult", () => {
  it("treats an exact answer as a clean pass", () => {
    expect(ratingFromResult({ correct: true, band: "perfect" })).toBe("good");
  });

  it("treats a near miss as a reduced pass so a typo does not wipe a streak", () => {
    expect(ratingFromResult({ correct: false, band: "great" })).toBe("hard");
  });

  it("treats anything below the great band as a lapse", () => {
    expect(ratingFromResult({ correct: false, band: "good" })).toBe("again");
    expect(ratingFromResult({ correct: false, band: "tryAgain" })).toBe("again");
  });
});

describe("determinism", () => {
  it("produces an identical patch for identical inputs", () => {
    const input = state({ practiceCount: 4, consecutiveSuccesses: 2, intervalDays: 11, ease: 2.2 });
    expect(sm2Scheduler.review(input, "good", REVIEWED_AT)).toEqual(
      sm2Scheduler.review(input, "good", REVIEWED_AT),
    );
  });

  it("does not mutate the state it is given", () => {
    const input = state({ practiceCount: 4, consecutiveSuccesses: 2, intervalDays: 11 });
    const snapshot = { ...input };
    sm2Scheduler.review(input, "again", REVIEWED_AT);
    expect(input).toEqual(snapshot);
  });

  it("reproduces a whole session identically", () => {
    const ratings: Rating[] = ["good", "hard", "again", "good", "easy", "good"];
    expect(play(ratings).final).toEqual(play(ratings).final);
  });

  it("is named so a future scheduler swap is visible", () => {
    expect(sm2Scheduler.name).toBe("sm2");
  });
});
