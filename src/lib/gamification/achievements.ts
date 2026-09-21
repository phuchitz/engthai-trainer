/**
 * Badges are **derived, never stored**.
 *
 * Nothing writes an "unlocked" flag: each badge is a predicate over the current stats,
 * which are themselves derived from the attempt log. So a badge cannot be out of date,
 * cannot be awarded twice, and re-deriving after an import gives the right answer for
 * whatever history the file brought with it.
 */

export type AchievementStats = {
  /** Distinct sentences passed, all time. */
  sentencesCompleted: number;
  totalXp: number;
  currentStreak: number;
  longestStreak: number;
  accuracyPercent: number;
  gradedAttempts: number;
  savedWords: number;
  activeMsTotal: number;
};

export type Achievement = {
  id: string;
  label: string;
  labelTh: string;
  description: string;
  /** Progress towards the badge, 0–1, for the ones worth showing a bar for. */
  progress: (stats: AchievementStats) => number;
};

const ratio = (value: number, target: number) => Math.min(1, target === 0 ? 1 : value / target);

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first-sentence",
    label: "First sentence",
    labelTh: "ประโยคแรก",
    description: "Answer one sentence correctly.",
    progress: (s) => ratio(s.sentencesCompleted, 1),
  },
  {
    id: "ten-sentences",
    label: "Ten down",
    labelTh: "ครบสิบประโยค",
    description: "Pass ten different sentences.",
    progress: (s) => ratio(s.sentencesCompleted, 10),
  },
  {
    id: "fifty-sentences",
    label: "Fifty down",
    labelTh: "ครบห้าสิบประโยค",
    description: "Pass fifty different sentences.",
    progress: (s) => ratio(s.sentencesCompleted, 50),
  },
  {
    id: "streak-3",
    label: "Three-day streak",
    labelTh: "ต่อเนื่องสามวัน",
    description: "Study three days in a row.",
    progress: (s) => ratio(s.longestStreak, 3),
  },
  {
    id: "streak-7",
    label: "Week-long streak",
    labelTh: "ต่อเนื่องหนึ่งสัปดาห์",
    description: "Study seven days in a row.",
    progress: (s) => ratio(s.longestStreak, 7),
  },
  {
    id: "xp-100",
    label: "Hundred XP",
    labelTh: "ครบร้อย XP",
    description: "Earn 100 XP.",
    progress: (s) => ratio(s.totalXp, 100),
  },
  {
    id: "sharp-shooter",
    label: "Sharp shooter",
    labelTh: "แม่นยำ",
    description: "Hold 90% accuracy over at least 20 graded answers.",
    // Both conditions must hold, so the bar tracks whichever is further behind.
    progress: (s) => Math.min(ratio(s.gradedAttempts, 20), ratio(s.accuracyPercent, 90)),
  },
  {
    id: "word-collector",
    label: "Word collector",
    labelTh: "นักสะสมคำศัพท์",
    description: "Save ten words to your vocabulary.",
    progress: (s) => ratio(s.savedWords, 10),
  },
  {
    id: "hour-of-practice",
    label: "An hour in",
    labelTh: "ฝึกครบหนึ่งชั่วโมง",
    description: "Accumulate one hour of active study time.",
    progress: (s) => ratio(s.activeMsTotal, 3_600_000),
  },
];

export function isUnlocked(achievement: Achievement, stats: AchievementStats): boolean {
  return achievement.progress(stats) >= 1;
}

export function unlockedAchievements(stats: AchievementStats): Achievement[] {
  return ACHIEVEMENTS.filter((a) => isUnlocked(a, stats));
}

export function lockedAchievements(stats: AchievementStats): Achievement[] {
  return ACHIEVEMENTS.filter((a) => !isUnlocked(a, stats));
}

/** Badges unlocked by the change from `before` to `after` — what a session just earned. */
export function newlyUnlocked(before: AchievementStats, after: AchievementStats): Achievement[] {
  const had = new Set(unlockedAchievements(before).map((a) => a.id));
  return unlockedAchievements(after).filter((a) => !had.has(a.id));
}
