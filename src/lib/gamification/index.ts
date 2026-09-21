export { xpForAnswer, XP_BY_BAND, HINT_MULTIPLIER } from "./xp";
export type { XpInput } from "./xp";

export { advanceStreak, currentStreak } from "./streak";
export type { Streak } from "./streak";

export { activeMs, formatDuration, StudyTimer, DEFAULT_IDLE_TIMEOUT_MS } from "./studyTime";
export type { TimelineEvent } from "./studyTime";

export { accuracyOf, accuracyOnLocalDay, sentencesCompletedToday, sentencesCompletedEver } from "./accuracy";
export type { Accuracy, ScoredAttempt, CountedAttempt } from "./accuracy";

export {
  ACHIEVEMENTS,
  isUnlocked,
  unlockedAchievements,
  lockedAchievements,
  newlyUnlocked,
} from "./achievements";
export type { Achievement, AchievementStats } from "./achievements";
