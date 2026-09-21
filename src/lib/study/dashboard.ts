import type { Attempt, Category, Sentence } from "@/lib/models";
import { isSameLocalDay } from "@/lib/srs";
import { CATEGORY_INFO } from "@/lib/models";
import {
  accuracyOf,
  accuracyOnLocalDay,
  currentStreak,
  sentencesCompletedEver,
  sentencesCompletedToday,
  unlockedAchievements,
  lockedAchievements,
  type Accuracy,
  type Achievement,
  type AchievementStats,
} from "@/lib/gamification";
import { listAttemptsInRange } from "@/lib/db/repositories/attempts";
import { listSentences } from "@/lib/db/repositories/sentences";
import { listVocabulary } from "@/lib/db/repositories/vocabulary";
import { loadSettings } from "@/lib/db/repositories/settings";
import { loadReviewCounts } from "./review";

export type RecentCategory = {
  category: Category;
  label: string;
  labelTh: string;
  attempts: number;
  lastPractisedAt: number;
};

export type DashboardData = {
  dailyGoal: number;
  sentencesToday: number;
  goalPercent: number;

  dueCount: number;
  mistakeCount: number;

  xpToday: number;
  xpTotal: number;

  currentStreak: number;
  longestStreak: number;

  accuracyToday: Accuracy;
  accuracyAllTime: Accuracy;

  /** Active milliseconds: background and idle time already excluded. */
  activeMsToday: number;
  activeMsTotal: number;

  recent: RecentCategory[];
  unlocked: Achievement[];
  locked: Achievement[];
  stats: AchievementStats;

  hasHistory: boolean;
};

/**
 * Sums the active time already recorded on each attempt.
 *
 * `Attempt.durationMs` is written by the study timer and has background and idle
 * stretches removed, so this is a straight sum rather than a fresh calculation.
 */
function sumActiveMs(attempts: readonly Pick<Attempt, "durationMs">[]): number {
  return attempts.reduce((total, attempt) => total + attempt.durationMs, 0);
}

function sumXp(attempts: readonly Pick<Attempt, "xpAwarded">[]): number {
  return attempts.reduce((total, attempt) => total + attempt.xpAwarded, 0);
}

/** The categories most recently practised, newest first. */
function recentCategories(
  attempts: readonly Attempt[],
  sentences: readonly Sentence[],
  limit = 4,
): RecentCategory[] {
  const categoryOf = new Map(sentences.map((s) => [s.id, s.category]));
  const seen = new Map<Category, { attempts: number; lastPractisedAt: number }>();

  for (const attempt of attempts) {
    if (attempt.itemType !== "sentence") continue;
    const category = categoryOf.get(attempt.itemId);
    if (!category) continue;

    const entry = seen.get(category);
    if (entry) {
      entry.attempts += 1;
      entry.lastPractisedAt = Math.max(entry.lastPractisedAt, attempt.createdAt);
    } else {
      seen.set(category, { attempts: 1, lastPractisedAt: attempt.createdAt });
    }
  }

  return [...seen.entries()]
    .map(([category, entry]) => ({
      category,
      label: CATEGORY_INFO[category].label,
      labelTh: CATEGORY_INFO[category].labelTh,
      ...entry,
    }))
    .sort((a, b) => b.lastPractisedAt - a.lastPractisedAt)
    .slice(0, limit);
}

/**
 * Everything the Dashboard shows, derived in one pass over the attempt log.
 *
 * No figure here is read from a stored counter: each is recomputed from the append-only
 * log plus the settings row, so nothing can drift out of step with what actually
 * happened. See docs/metrics.md for the definitions.
 */
export async function loadDashboard(now: number = Date.now()): Promise<DashboardData> {
  const [attempts, sentences, vocabulary, settings, reviewCounts] = await Promise.all([
    listAttemptsInRange(0, now),
    listSentences(),
    listVocabulary(),
    loadSettings(now),
    loadReviewCounts(now),
  ]);

  const todays = attempts.filter((a) => isSameLocalDay(a.createdAt, now));

  const accuracyAllTime = accuracyOf(attempts);
  const activeMsTotal = sumActiveMs(attempts);
  const savedWords = vocabulary.filter((v) => v.saved).length;

  const stats: AchievementStats = {
    sentencesCompleted: sentencesCompletedEver(attempts),
    totalXp: sumXp(attempts),
    currentStreak: currentStreak(settings.streak, now),
    longestStreak: settings.streak.longest,
    accuracyPercent: accuracyAllTime.percent,
    gradedAttempts: accuracyAllTime.graded,
    savedWords,
    activeMsTotal,
  };

  const sentencesToday = sentencesCompletedToday(attempts, now);

  return {
    dailyGoal: settings.dailyGoal,
    sentencesToday,
    goalPercent:
      settings.dailyGoal === 0 ? 0 : Math.min(100, Math.round((sentencesToday / settings.dailyGoal) * 100)),

    dueCount: reviewCounts.due,
    mistakeCount: reviewCounts.mistakes,

    xpToday: sumXp(todays),
    xpTotal: stats.totalXp,

    currentStreak: stats.currentStreak,
    longestStreak: stats.longestStreak,

    accuracyToday: accuracyOnLocalDay(attempts, now),
    accuracyAllTime,

    activeMsToday: sumActiveMs(todays),
    activeMsTotal,

    recent: recentCategories(attempts, sentences),
    unlocked: unlockedAchievements(stats),
    locked: lockedAchievements(stats),
    stats,

    hasHistory: attempts.length > 0,
  };
}
