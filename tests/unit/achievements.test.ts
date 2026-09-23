import { describe, it, expect } from "vitest";
import {
  ACHIEVEMENTS,
  isUnlocked,
  lockedAchievements,
  newlyUnlocked,
  unlockedAchievements,
  type AchievementStats,
} from "@/lib/gamification";

const NOTHING: AchievementStats = {
  sentencesCompleted: 0,
  totalXp: 0,
  currentStreak: 0,
  longestStreak: 0,
  accuracyPercent: 0,
  gradedAttempts: 0,
  savedWords: 0,
  activeMsTotal: 0,
};

const stats = (over: Partial<AchievementStats> = {}): AchievementStats => ({ ...NOTHING, ...over });
const badge = (id: string) => ACHIEVEMENTS.find((a) => a.id === id)!;

describe("the badge list itself", () => {
  it("uses no id twice", () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
  });

  it("labels every badge in both languages", () => {
    for (const a of ACHIEVEMENTS) {
      expect(a.label.length, a.id).toBeGreaterThan(0);
      expect(a.labelTh, a.id).toMatch(/[฀-๿]/);
      expect(a.description.length, a.id).toBeGreaterThan(0);
    }
  });

  it("starts every badge locked on a fresh account", () => {
    expect(unlockedAchievements(NOTHING)).toHaveLength(0);
    expect(lockedAchievements(NOTHING)).toHaveLength(ACHIEVEMENTS.length);
  });

  it("reports progress as a fraction between zero and one", () => {
    // The bar is rendered straight from this, so a value above one would overflow it.
    const huge = stats({
      sentencesCompleted: 9999,
      totalXp: 9999,
      longestStreak: 9999,
      accuracyPercent: 100,
      gradedAttempts: 9999,
      savedWords: 9999,
      activeMsTotal: 9_999_999_999,
    });
    for (const a of ACHIEVEMENTS) {
      expect(a.progress(NOTHING), a.id).toBe(0);
      expect(a.progress(huge), a.id).toBe(1);
    }
  });
});

describe("each badge unlocks on its own threshold", () => {
  it.each([
    ["first-sentence", { sentencesCompleted: 1 }, { sentencesCompleted: 0 }],
    ["ten-sentences", { sentencesCompleted: 10 }, { sentencesCompleted: 9 }],
    ["fifty-sentences", { sentencesCompleted: 50 }, { sentencesCompleted: 49 }],
    ["streak-3", { longestStreak: 3 }, { longestStreak: 2 }],
    ["streak-7", { longestStreak: 7 }, { longestStreak: 6 }],
    ["xp-100", { totalXp: 100 }, { totalXp: 99 }],
    ["word-collector", { savedWords: 10 }, { savedWords: 9 }],
    ["hour-of-practice", { activeMsTotal: 3_600_000 }, { activeMsTotal: 3_599_999 }],
  ] as const)("%s", (id, enough, notQuite) => {
    expect(isUnlocked(badge(id), stats(enough))).toBe(true);
    expect(isUnlocked(badge(id), stats(notQuite))).toBe(false);
  });
});

describe("sharp shooter needs both accuracy and a sample size", () => {
  const sharp = badge("sharp-shooter");

  it("stays locked on a perfect record that is too short to mean anything", () => {
    expect(isUnlocked(sharp, stats({ accuracyPercent: 100, gradedAttempts: 19 }))).toBe(false);
  });

  it("stays locked on enough answers at too low an accuracy", () => {
    expect(isUnlocked(sharp, stats({ accuracyPercent: 89, gradedAttempts: 200 }))).toBe(false);
  });

  it("unlocks when both hold", () => {
    expect(isUnlocked(sharp, stats({ accuracyPercent: 90, gradedAttempts: 20 }))).toBe(true);
  });

  it("tracks whichever condition is further behind", () => {
    // 10 of 20 answers but full accuracy: the bar must show the answer count, not 100%.
    expect(sharp.progress(stats({ accuracyPercent: 100, gradedAttempts: 10 }))).toBeCloseTo(0.5);
    expect(sharp.progress(stats({ accuracyPercent: 45, gradedAttempts: 100 }))).toBeCloseTo(0.5);
  });
});

describe("streaks are judged on the longest, not the current one", () => {
  it("keeps a badge the learner has already earned after a missed day", () => {
    // Badges are predicates over stats, so one bad day must not take a badge back.
    const afterBreak = stats({ currentStreak: 0, longestStreak: 7 });
    expect(isUnlocked(badge("streak-3"), afterBreak)).toBe(true);
    expect(isUnlocked(badge("streak-7"), afterBreak)).toBe(true);
  });

  it("does not unlock on a current streak alone", () => {
    expect(isUnlocked(badge("streak-3"), stats({ currentStreak: 5, longestStreak: 0 }))).toBe(false);
  });
});

describe("newlyUnlocked reports only what a session earned", () => {
  it("names the badges crossed between two snapshots", () => {
    const before = stats({ sentencesCompleted: 9, totalXp: 90 });
    const after = stats({ sentencesCompleted: 10, totalXp: 100 });

    expect(newlyUnlocked(before, after).map((a) => a.id)).toEqual(["ten-sentences", "xp-100"]);
  });

  it("does not repeat a badge that was already held", () => {
    const before = stats({ sentencesCompleted: 1 });
    const after = stats({ sentencesCompleted: 4 });
    expect(newlyUnlocked(before, after)).toHaveLength(0);
  });

  it("returns nothing when nothing changed", () => {
    const same = stats({ sentencesCompleted: 12, totalXp: 120 });
    expect(newlyUnlocked(same, same)).toHaveLength(0);
  });

  it("never reports a badge going backwards", () => {
    // Deleting data can lower the stats; that is not an unlock event.
    const high = stats({ sentencesCompleted: 50 });
    expect(newlyUnlocked(high, NOTHING)).toHaveLength(0);
  });
});

describe("unlocked and locked always partition the list", () => {
  it.each([
    NOTHING,
    stats({ sentencesCompleted: 10, totalXp: 100 }),
    stats({ sentencesCompleted: 50, totalXp: 600, longestStreak: 7, savedWords: 10 }),
  ])("case %#", (s) => {
    expect(unlockedAchievements(s).length + lockedAchievements(s).length).toBe(ACHIEVEMENTS.length);
  });
});
