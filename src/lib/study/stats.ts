import type { Category, Level, Sentence, SentenceProgress } from "@/lib/models";
import { CATEGORIES } from "@/lib/models";
import { isDue } from "@/lib/srs";
import { listSentences } from "@/lib/db/repositories/sentences";
import { listAllProgress } from "@/lib/db/repositories/progress";

export type CategorySummary = {
  category: Category;
  total: number;
  /** Sentences answered correctly at least once, in any direction. */
  completed: number;
  due: number;
  completionPercent: number;
  levels: Level[];
};

/**
 * Per-category counts for the Lessons screen.
 *
 * Every category is returned, including empty ones: a category with no sentences is a
 * real state the learner should see, not something to hide.
 */
export async function loadCategorySummaries(now: number = Date.now()): Promise<CategorySummary[]> {
  const [sentences, progress] = await Promise.all([listSentences(), listAllProgress()]);

  const byItem = new Map<string, SentenceProgress[]>();
  for (const row of progress) {
    if (row.itemType !== "sentence") continue;
    const list = byItem.get(row.itemId);
    if (list) list.push(row);
    else byItem.set(row.itemId, [row]);
  }

  const grouped = new Map<Category, Sentence[]>(CATEGORIES.map((c) => [c, []]));
  for (const sentence of sentences) grouped.get(sentence.category)?.push(sentence);

  return CATEGORIES.map((category) => {
    const items = grouped.get(category) ?? [];
    let completed = 0;
    let due = 0;

    for (const sentence of items) {
      const rows = byItem.get(sentence.id) ?? [];
      if (rows.some((row) => row.correctCount > 0)) completed += 1;
      if (rows.some((row) => isDue(row, now))) due += 1;
    }

    const levels = [...new Set(items.map((s) => s.level))].sort();

    return {
      category,
      total: items.length,
      completed,
      due,
      completionPercent: items.length === 0 ? 0 : Math.round((completed / items.length) * 100),
      levels,
    };
  });
}
