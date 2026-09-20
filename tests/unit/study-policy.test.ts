import { describe, it, expect } from "vitest";
import {
  attemptsTodayFor,
  cardsCompletedToday,
  isPass,
  shouldAwardXp,
  shouldSchedule,
  type PriorAttempt,
} from "@/lib/study";
import { addLocalDays } from "@/lib/srs";

const NOW = Date.parse("2026-09-20T15:00:00+07:00");
const CARD = "sentence:s1:th2en";
const OTHER = "sentence:s2:th2en";

const at = (
  verdict: PriorAttempt["verdict"],
  createdAt: number = NOW,
  progressId: string = CARD,
): PriorAttempt => ({ progressId, verdict, createdAt });

describe("isPass", () => {
  it("counts exact and near-miss answers as passes", () => {
    expect(isPass("correct")).toBe(true);
    expect(isPass("close")).toBe(true);
  });

  it("counts everything else as not a pass", () => {
    expect(isPass("incorrect")).toBe(false);
    expect(isPass("skipped")).toBe(false);
    expect(isPass("revealed")).toBe(false);
  });
});

describe("attemptsTodayFor", () => {
  it("ignores other cards and other days", () => {
    const attempts = [
      at("correct"),
      at("correct", NOW, OTHER),
      at("correct", addLocalDays(NOW, -1)),
      at("correct", addLocalDays(NOW, 1)),
    ];
    expect(attemptsTodayFor(attempts, CARD, NOW)).toHaveLength(1);
  });

  it("counts the whole local day, not a rolling window", () => {
    const attempts = [at("correct", Date.parse("2026-09-20T00:05:00+07:00"))];
    expect(attemptsTodayFor(attempts, CARD, Date.parse("2026-09-20T23:55:00+07:00"))).toHaveLength(1);
  });
});

describe("shouldAwardXp", () => {
  it("pays for the first answer of the day", () => {
    expect(shouldAwardXp([], CARD, NOW)).toBe(true);
  });

  it("does not pay twice for the same card on the same day", () => {
    expect(shouldAwardXp([at("correct")], CARD, NOW)).toBe(false);
  });

  it("does not pay again after a near-miss pass either", () => {
    expect(shouldAwardXp([at("close")], CARD, NOW)).toBe(false);
  });

  it("still pays after earlier failures, because none of them was a pass", () => {
    expect(shouldAwardXp([at("incorrect"), at("incorrect")], CARD, NOW)).toBe(true);
  });

  it("still pays after a skip", () => {
    expect(shouldAwardXp([at("skipped")], CARD, NOW)).toBe(true);
  });

  it("pays again the next day", () => {
    expect(shouldAwardXp([at("correct", addLocalDays(NOW, -1))], CARD, NOW)).toBe(true);
  });

  it("is unaffected by another card being passed", () => {
    expect(shouldAwardXp([at("correct", NOW, OTHER)], CARD, NOW)).toBe(true);
  });

  it("blocks a resubmission of the same answer", () => {
    // What a double Enter press or a refresh-and-resubmit looks like in the log.
    const first = [at("correct")];
    expect(shouldAwardXp(first, CARD, NOW)).toBe(false);
    expect(shouldAwardXp([...first, at("correct")], CARD, NOW)).toBe(false);
  });

  it("stays false however many passes accumulate", () => {
    const many = Array.from({ length: 10 }, () => at("correct"));
    expect(shouldAwardXp(many, CARD, NOW)).toBe(false);
  });
});

describe("shouldSchedule", () => {
  it("moves the schedule on the first graded answer of the day", () => {
    expect(shouldSchedule([], CARD, NOW)).toBe(true);
  });

  it("does not move it again after a pass", () => {
    expect(shouldSchedule([at("correct")], CARD, NOW)).toBe(false);
  });

  it("does not move it again after a failure, so retrying cannot buy a longer interval", () => {
    expect(shouldSchedule([at("incorrect")], CARD, NOW)).toBe(false);
  });

  it("is not consumed by a skip, because a skip is not graded", () => {
    expect(shouldSchedule([at("skipped"), at("skipped")], CARD, NOW)).toBe(true);
  });

  it("moves again the next day", () => {
    expect(shouldSchedule([at("incorrect", addLocalDays(NOW, -1))], CARD, NOW)).toBe(true);
  });

  it("is independent per card", () => {
    expect(shouldSchedule([at("correct", NOW, OTHER)], CARD, NOW)).toBe(true);
  });
});

describe("XP and scheduling diverge on a retry", () => {
  it("a failure then a pass schedules once but still pays, because the failure was not a pass", () => {
    const afterFailure = [at("incorrect")];
    expect(shouldSchedule(afterFailure, CARD, NOW)).toBe(false);
    expect(shouldAwardXp(afterFailure, CARD, NOW)).toBe(true);
  });
});

describe("cardsCompletedToday", () => {
  it("is zero with no attempts", () => {
    expect(cardsCompletedToday([], NOW)).toBe(0);
  });

  it("counts distinct cards rather than attempts", () => {
    const attempts = [at("correct"), at("correct"), at("close", NOW, OTHER)];
    expect(cardsCompletedToday(attempts, NOW)).toBe(2);
  });

  it("ignores failures and skips", () => {
    expect(cardsCompletedToday([at("incorrect"), at("skipped")], NOW)).toBe(0);
  });

  it("ignores other days", () => {
    expect(cardsCompletedToday([at("correct", addLocalDays(NOW, -1))], NOW)).toBe(0);
  });
});
