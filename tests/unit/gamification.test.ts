import { describe, it, expect } from "vitest";
import { advanceStreak, currentStreak, xpForAnswer, XP_BY_BAND } from "@/lib/gamification";
import { addLocalDays, localDateKey } from "@/lib/srs";

const NOW = Date.parse("2026-09-20T15:00:00+07:00");
const TODAY = localDateKey(NOW);
const YESTERDAY = localDateKey(addLocalDays(NOW, -1));

const streak = (over: Partial<ReturnType<typeof base>> = {}) => ({ ...base(), ...over });
const base = () => ({ current: 0, longest: 0, lastStudyDate: null as string | null, freezesRemaining: 0 });

describe("xpForAnswer", () => {
  it("pays for a perfect answer", () => {
    expect(xpForAnswer({ band: "perfect", hintUsed: false })).toBe(XP_BY_BAND.perfect);
  });

  it("pays less for a near miss", () => {
    const great = xpForAnswer({ band: "great", hintUsed: false });
    expect(great).toBeGreaterThan(0);
    expect(great).toBeLessThan(xpForAnswer({ band: "perfect", hintUsed: false }));
  });

  it("pays nothing below the great band", () => {
    expect(xpForAnswer({ band: "good", hintUsed: false })).toBe(0);
    expect(xpForAnswer({ band: "tryAgain", hintUsed: false })).toBe(0);
  });

  it("halves the award when the hint was used", () => {
    expect(xpForAnswer({ band: "perfect", hintUsed: true })).toBe(5);
    expect(xpForAnswer({ band: "great", hintUsed: true })).toBe(3);
  });

  it("never returns a negative or fractional amount", () => {
    for (const band of ["perfect", "great", "good", "tryAgain"] as const) {
      for (const hintUsed of [true, false]) {
        const xp = xpForAnswer({ band, hintUsed });
        expect(Number.isInteger(xp)).toBe(true);
        expect(xp).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("advanceStreak", () => {
  it("starts a streak at one", () => {
    const next = advanceStreak(streak(), NOW);
    expect(next.current).toBe(1);
    expect(next.longest).toBe(1);
    expect(next.lastStudyDate).toBe(TODAY);
  });

  it("extends a streak from yesterday", () => {
    const next = advanceStreak(streak({ current: 4, longest: 9, lastStudyDate: YESTERDAY }), NOW);
    expect(next.current).toBe(5);
    expect(next.longest).toBe(9);
  });

  it("raises the longest streak when the current one passes it", () => {
    const next = advanceStreak(streak({ current: 9, longest: 9, lastStudyDate: YESTERDAY }), NOW);
    expect(next.longest).toBe(10);
  });

  it("resets after a missed day", () => {
    const twoDaysAgo = localDateKey(addLocalDays(NOW, -2));
    const next = advanceStreak(streak({ current: 12, longest: 12, lastStudyDate: twoDaysAgo }), NOW);
    expect(next.current).toBe(1);
    expect(next.longest).toBe(12);
  });

  it("is idempotent within one day, so it can run on every answer", () => {
    const once = advanceStreak(streak({ current: 3, longest: 5, lastStudyDate: YESTERDAY }), NOW);
    const twice = advanceStreak(once, NOW);
    const thrice = advanceStreak(twice, Date.parse("2026-09-20T23:00:00+07:00"));
    expect(once.current).toBe(4);
    expect(twice).toBe(once);
    expect(thrice.current).toBe(4);
  });

  it("counts calendar days, not 24-hour windows", () => {
    const lateNight = Date.parse("2026-09-20T23:50:00+07:00");
    const justAfter = Date.parse("2026-09-21T00:10:00+07:00");
    const first = advanceStreak(streak(), lateNight);
    const second = advanceStreak(first, justAfter);
    expect(second.current).toBe(2);
  });

  it("does not mutate the streak it is given", () => {
    const input = streak({ current: 3, longest: 5, lastStudyDate: YESTERDAY });
    const snapshot = { ...input };
    advanceStreak(input, NOW);
    expect(input).toEqual(snapshot);
  });
});

describe("currentStreak", () => {
  it("is zero before any study", () => {
    expect(currentStreak(streak(), NOW)).toBe(0);
  });

  it("shows the stored streak when studied today or yesterday", () => {
    expect(currentStreak(streak({ current: 6, lastStudyDate: TODAY }), NOW)).toBe(6);
    expect(currentStreak(streak({ current: 6, lastStudyDate: YESTERDAY }), NOW)).toBe(6);
  });

  it("reports a broken streak as zero even though storage still says otherwise", () => {
    const stale = streak({ current: 6, longest: 6, lastStudyDate: localDateKey(addLocalDays(NOW, -3)) });
    expect(stale.current).toBe(6);
    expect(currentStreak(stale, NOW)).toBe(0);
  });
});
