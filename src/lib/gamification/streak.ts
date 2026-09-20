import type { Settings } from "@/lib/models";
import { addLocalDays, localDateKey } from "@/lib/srs";

export type Streak = Settings["streak"];

/**
 * Advances the streak for a day on which the learner studied.
 *
 * Counted in **local calendar days**, not 24-hour windows: studying at 23:50 and again
 * at 00:10 is two days, and studying twice in one evening is one. Anything other than
 * yesterday breaks the streak and starts a new one at 1.
 *
 * Idempotent within a day, so it can be called on every answer without inflating.
 */
export function advanceStreak(streak: Streak, now: number): Streak {
  const today = localDateKey(now);
  if (streak.lastStudyDate === today) return streak;

  const yesterday = localDateKey(addLocalDays(now, -1));
  const current = streak.lastStudyDate === yesterday ? streak.current + 1 : 1;

  return {
    ...streak,
    current,
    longest: Math.max(streak.longest, current),
    lastStudyDate: today,
  };
}

/**
 * The streak as it should be *displayed*, which is not always the stored value: a stored
 * streak whose last study day is older than yesterday has already been broken, even
 * though nothing has written to it since.
 */
export function currentStreak(streak: Streak, now: number): number {
  if (!streak.lastStudyDate) return 0;
  const today = localDateKey(now);
  const yesterday = localDateKey(addLocalDays(now, -1));
  if (streak.lastStudyDate === today || streak.lastStudyDate === yesterday) return streak.current;
  return 0;
}
