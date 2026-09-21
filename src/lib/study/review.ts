import type { Direction, Sentence, SentenceProgress, Settings } from "@/lib/models";
import { buildMistakeQueue, buildQueue } from "@/lib/srs";
import { MODE_INFO, type ImplementedMode } from "@/lib/exercises";
import { listSentences } from "@/lib/db/repositories/sentences";
import { listAllProgress } from "@/lib/db/repositories/progress";

export type ReviewKind = "due" | "mistakes";

export type StudyCard = {
  sentence: Sentence;
  mode: ImplementedMode;
};

/**
 * The default mode for reviewing a card in a given direction.
 *
 * Review runs mixed modes rather than one chosen mode, because the card's direction is
 * what decides how it can be asked: a `th2en` card is a translation, an `en2th` card is
 * built from tiles. Asking an `en2th` card as dictation would test the wrong skill.
 */
export function modeForDirection(direction: Direction): ImplementedMode {
  return direction === "en2th" ? "wordOrder" : "translate";
}

type Row = SentenceProgress & { sentence: Sentence };

async function loadRows(): Promise<Row[]> {
  const [sentences, progress] = await Promise.all([listSentences(), listAllProgress()]);
  const byId = new Map(sentences.map((sentence) => [sentence.id, sentence]));

  const rows: Row[] = [];
  for (const row of progress) {
    if (row.itemType !== "sentence") continue;
    const sentence = byId.get(row.itemId);
    if (sentence) rows.push({ ...row, sentence });
  }
  return rows;
}

export type ReviewCounts = {
  due: number;
  mistakes: number;
};

export async function loadReviewCounts(now: number = Date.now()): Promise<ReviewCounts> {
  const rows = await loadRows();
  return {
    due: buildQueue(rows, { now }).totalDue,
    mistakes: buildMistakeQueue(rows).length,
  };
}

/**
 * Builds one of the two review queues.
 *
 * They are separate on purpose and may overlap: a card that is both due and repeatedly
 * failed belongs in each, and hiding it from one of them would misrepresent the backlog.
 */
export async function buildReviewQueue(
  kind: ReviewKind,
  settings: Pick<Settings, "maxReviewsPerDay">,
  now: number = Date.now(),
): Promise<StudyCard[]> {
  const rows = await loadRows();

  const selected =
    kind === "due"
      ? buildQueue(rows, { now, newLimit: 0, reviewLimit: settings.maxReviewsPerDay }).due
      : buildMistakeQueue(rows, { limit: settings.maxReviewsPerDay });

  return selected.map((row) => ({
    sentence: row.sentence,
    mode: modeForDirection(row.direction),
  }));
}

export const REVIEW_LABELS: Record<ReviewKind, { title: string; description: string }> = {
  due: {
    title: "Due today",
    description: "Cards the scheduler says are ready, longest overdue first.",
  },
  mistakes: {
    title: "Mistakes",
    description: "Cards you have got wrong, worst first — regardless of when they are next due.",
  },
};

export { MODE_INFO };
