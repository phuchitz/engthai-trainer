export const MS_PER_DAY = 86_400_000;

/**
 * Midnight at the start of the local calendar day containing `timestamp`.
 *
 * Scheduling is a calendar concept, not an elapsed-hours one: a card scheduled for
 * Thursday is due from the moment Thursday begins, whether the learner reviewed it at
 * 07:00 or 23:00 the previous week.
 */
export function startOfLocalDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/**
 * Midnight `days` calendar days after the local day containing `timestamp`.
 *
 * Uses `setDate` rather than adding milliseconds so a day is whatever the calendar says
 * it is — across a daylight-saving boundary that is 23 or 25 hours, not 24.
 */
export function addLocalDays(timestamp: number, days: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.getTime();
}

/** Whole calendar days from the local day of `from` to the local day of `to`. */
export function localDaysBetween(from: number, to: number): number {
  return Math.round((startOfLocalDay(to) - startOfLocalDay(from)) / MS_PER_DAY);
}

export function isSameLocalDay(a: number, b: number): boolean {
  return startOfLocalDay(a) === startOfLocalDay(b);
}

/** `YYYY-MM-DD` in local time — the key used for streaks and the review heatmap. */
export function localDateKey(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
