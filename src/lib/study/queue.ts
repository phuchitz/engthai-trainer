import type { Category, Direction, Sentence, Settings } from "@/lib/models";
import { buildQueue } from "@/lib/srs";
import { listSentencesByCategory } from "@/lib/db/repositories/sentences";
import { getProgress, newProgress } from "@/lib/db/repositories/progress";
import { progressId } from "@/lib/utils/id";
import { DICTATION_DIRECTION } from "./grade";

/**
 * The cards to study in one sitting, ordered by the scheduler: reviews first
 * (longest-overdue first), then new cards up to the daily allowance.
 *
 * A sentence with no progress row yet is treated as new rather than skipped, so a
 * sentence added by an import is studiable immediately without a backfill step.
 */
export async function buildStudyQueue(
  category: Category,
  settings: Pick<Settings, "newPerDay" | "maxReviewsPerDay">,
  now: number = Date.now(),
  direction: Direction = DICTATION_DIRECTION,
): Promise<Sentence[]> {
  const sentences = await listSentencesByCategory(category);

  const rows = await Promise.all(
    sentences.map(async (sentence) => {
      const id = progressId("sentence", sentence.id, direction);
      const progress = (await getProgress(id)) ?? newProgress("sentence", sentence.id, direction, now);
      return { ...progress, sentence };
    }),
  );

  return buildQueue(rows, {
    now,
    newLimit: settings.newPerDay,
    reviewLimit: settings.maxReviewsPerDay,
  }).combined.map((row) => row.sentence);
}

export type CategoryStats = {
  category: Category;
  total: number;
  /** Sentences answered correctly at least once, in either direction. */
  completed: number;
  due: number;
  completionPercent: number;
};
