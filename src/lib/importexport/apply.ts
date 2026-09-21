import type { Sentence, VocabularyEntry } from "@/lib/models";
import { sentenceSchema, vocabularyEntrySchema } from "@/lib/models";
import { getSentence, listSentences, putSentence } from "@/lib/db/repositories/sentences";
import { putVocabularyEntry } from "@/lib/db/repositories/vocabulary";
import { ensureProgressForItem } from "@/lib/db/repositories/progress";
import { newId } from "@/lib/utils/id";
import type { DuplicateMode, ImportPlan, PlannedRow } from "./plan";

export type ImportResult = {
  created: number;
  updated: number;
  skipped: number;
  vocabularyCreated: number;
  progressCreated: number;
};

async function writeVocabulary(row: PlannedRow, now: number): Promise<string[]> {
  const ids: string[] = [];

  for (const item of row.row.vocabulary) {
    const entry: VocabularyEntry = vocabularyEntrySchema.parse({
      id: newId(now),
      en: item.en,
      th: item.th,
      forms: [],
      contexts: [],
      saved: false,
      exampleSentenceIds: [],
      tags: [],
      level: row.row.level,
      source: "imported",
      createdAt: now,
      updatedAt: now,
    });
    await putVocabularyEntry(entry);
    ids.push(entry.id);
  }

  return ids;
}

function toSentence(
  row: PlannedRow,
  id: string,
  vocabIds: string[],
  createdAt: number,
  now: number,
): Sentence {
  const example = row.row.examples[0];

  return sentenceSchema.parse({
    id,
    en: row.row.english,
    th: row.row.thai,
    enAlternates: row.row.acceptedAnswers,
    thAlternates: [],
    transliteration: row.row.transliteration,
    hint: row.row.hint,
    notes: row.row.grammarExplanation,
    exampleEn: example?.en,
    exampleTh: example?.th,
    tags: [],
    category: row.row.category,
    level: row.row.level,
    lessonIds: [],
    vocabIds,
    source: "imported",
    createdAt,
    updatedAt: now,
  });
}

/**
 * Writes an already-reviewed plan.
 *
 * Updating a duplicate reuses the **existing sentence id**, which is what preserves
 * learning history: progress rows and attempts key on that id, so replacing the text
 * leaves the schedule and the answer log exactly where they were.
 */
export async function applyImportPlan(
  plan: ImportPlan,
  mode: DuplicateMode,
  now: number = Date.now(),
): Promise<ImportResult> {
  const result: ImportResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    vocabularyCreated: 0,
    progressCreated: 0,
  };

  for (const row of plan.create) {
    const id = newId(now);
    const vocabIds = await writeVocabulary(row, now);
    result.vocabularyCreated += vocabIds.length;

    await putSentence(toSentence(row, id, vocabIds, now, now));
    result.progressCreated += await ensureProgressForItem("sentence", id, now);
    result.created += 1;
  }

  for (const row of plan.duplicates) {
    // A duplicate of an earlier row in the same file has no distinct sentence to update.
    if (mode !== "update" || row.duplicateOf?.kind !== "existing") {
      result.skipped += 1;
      continue;
    }

    const id = row.duplicateOf.sentenceId;
    const current = await getSentence(id);
    if (!current) {
      result.skipped += 1;
      continue;
    }

    const vocabIds = await writeVocabulary(row, now);
    result.vocabularyCreated += vocabIds.length;

    await putSentence(
      toSentence(
        row,
        id,
        // Keep whatever the sentence already pointed at; imports add rather than replace.
        [...new Set([...current.vocabIds, ...vocabIds])],
        current.createdAt,
        now,
      ),
    );
    result.updated += 1;
  }

  return result;
}

/** The existing sentences, reduced to what duplicate detection needs. */
export async function loadExistingForDuplicates(): Promise<{ id: string; en: string }[]> {
  return (await listSentences()).map((sentence) => ({ id: sentence.id, en: sentence.en }));
}
