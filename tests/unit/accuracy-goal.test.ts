import { describe, it, expect } from "vitest";
import {
  accuracyOf,
  accuracyOnLocalDay,
  sentencesCompletedEver,
  sentencesCompletedToday,
  type CountedAttempt,
} from "@/lib/gamification";
import { addLocalDays } from "@/lib/srs";
import type { Attempt } from "@/lib/models";

const NOW = Date.parse("2026-09-21T15:00:00+07:00");

const scored = (verdict: Attempt["verdict"], createdAt = NOW) => ({ verdict, createdAt });

const counted = (
  itemId: string,
  verdict: Attempt["verdict"],
  createdAt = NOW,
  itemType: Attempt["itemType"] = "sentence",
): CountedAttempt => ({ itemId, itemType, verdict, createdAt });

describe("accuracyOf", () => {
  it("is zero with no attempts, not NaN", () => {
    expect(accuracyOf([])).toEqual({ graded: 0, passed: 0, percent: 0 });
  });

  it("counts an exact answer as a pass", () => {
    expect(accuracyOf([scored("correct")]).percent).toBe(100);
  });

  it("counts a near miss as a pass, matching the XP and streak rules", () => {
    expect(accuracyOf([scored("close")]).percent).toBe(100);
  });

  it("counts a wrong answer against the total", () => {
    expect(accuracyOf([scored("correct"), scored("incorrect")])).toEqual({
      graded: 2,
      passed: 1,
      percent: 50,
    });
  });

  it("excludes skips entirely, because declining is not a wrong answer", () => {
    const attempts = [scored("correct"), scored("skipped"), scored("skipped")];
    expect(accuracyOf(attempts)).toEqual({ graded: 1, passed: 1, percent: 100 });
  });

  it("is zero when every attempt was skipped", () => {
    expect(accuracyOf([scored("skipped")])).toEqual({ graded: 0, passed: 0, percent: 0 });
  });

  it("counts every attempt, so retrying a card lowers accuracy", () => {
    // Wrong, wrong, then right: the learner got there, but two of three were wrong.
    const attempts = [scored("incorrect"), scored("incorrect"), scored("correct")];
    expect(accuracyOf(attempts).percent).toBe(33);
  });

  it("rounds to the nearest whole percent", () => {
    const attempts = [scored("correct"), scored("correct"), scored("incorrect")];
    expect(accuracyOf(attempts).percent).toBe(67);
  });

  it("treats a revealed answer as not passing", () => {
    expect(accuracyOf([scored("revealed")])).toEqual({ graded: 1, passed: 0, percent: 0 });
  });
});

describe("accuracyOnLocalDay", () => {
  it("ignores other days", () => {
    const attempts = [
      scored("correct"),
      scored("incorrect", addLocalDays(NOW, -1)),
      scored("incorrect", addLocalDays(NOW, -3)),
    ];
    expect(accuracyOnLocalDay(attempts, NOW)).toEqual({ graded: 1, passed: 1, percent: 100 });
  });

  it("covers the whole calendar day, not a rolling window", () => {
    const attempts = [
      scored("correct", Date.parse("2026-09-21T00:05:00+07:00")),
      scored("incorrect", Date.parse("2026-09-21T23:55:00+07:00")),
    ];
    expect(accuracyOnLocalDay(attempts, NOW).graded).toBe(2);
  });
});

describe("sentencesCompletedToday", () => {
  it("is zero before anything is answered", () => {
    expect(sentencesCompletedToday([], NOW)).toBe(0);
  });

  it("counts one per distinct sentence passed", () => {
    expect(sentencesCompletedToday([counted("s1", "correct"), counted("s2", "correct")], NOW)).toBe(2);
  });

  it("does not count the same sentence twice, however many attempts", () => {
    const attempts = [counted("s1", "correct"), counted("s1", "correct"), counted("s1", "close")];
    expect(sentencesCompletedToday(attempts, NOW)).toBe(1);
  });

  it("counts a sentence once even when both directions are practised", () => {
    // Two cards, one sentence: the goal must tick once.
    const attempts = [counted("s1", "correct"), counted("s1", "correct")];
    expect(sentencesCompletedToday(attempts, NOW)).toBe(1);
  });

  it("ignores failures and skips", () => {
    expect(sentencesCompletedToday([counted("s1", "incorrect"), counted("s2", "skipped")], NOW)).toBe(0);
  });

  it("counts a sentence that was failed and later passed", () => {
    expect(sentencesCompletedToday([counted("s1", "incorrect"), counted("s1", "correct")], NOW)).toBe(1);
  });

  it("ignores other days", () => {
    expect(sentencesCompletedToday([counted("s1", "correct", addLocalDays(NOW, -1))], NOW)).toBe(0);
  });

  it("ignores vocabulary attempts, which are not sentences", () => {
    expect(sentencesCompletedToday([counted("v1", "correct", NOW, "vocab")], NOW)).toBe(0);
  });
});

describe("sentencesCompletedEver", () => {
  it("counts distinct sentences across every day", () => {
    const attempts = [
      counted("s1", "correct", addLocalDays(NOW, -5)),
      counted("s1", "correct"),
      counted("s2", "close", addLocalDays(NOW, -2)),
    ];
    expect(sentencesCompletedEver(attempts)).toBe(2);
  });

  it("ignores sentences only ever failed", () => {
    expect(sentencesCompletedEver([counted("s1", "incorrect")])).toBe(0);
  });
});
