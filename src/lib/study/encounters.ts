import type { Attempt, Sentence, VocabularyEntry } from "@/lib/models";
import { normalizeEnglish } from "@/lib/answer";

export type EncounterAttempt = Pick<Attempt, "itemType" | "itemId">;

/**
 * Maps each vocabulary entry to the sentences that contain it.
 *
 * Built from the sentences' curated `vocabIds` rather than by scanning text, so a word
 * is only ever linked where an author said it belongs.
 */
export function sentencesByVocab(sentences: Pick<Sentence, "id" | "vocabIds">[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const sentence of sentences) {
    for (const vocabId of sentence.vocabIds) {
      const set = map.get(vocabId);
      if (set) set.add(sentence.id);
      else map.set(vocabId, new Set([sentence.id]));
    }
  }
  return map;
}

/**
 * How many times the learner has met a word while practising.
 *
 * Derived from the attempt log rather than kept as a counter, so it cannot drift and
 * needs no write on every answer. Every attempt counts, including skips and repeats:
 * the word came up, which is what "encounter" means here. Opening the word panel is
 * *not* an encounter — looking something up is not the same as meeting it in use.
 */
export function encounterCount(attempts: EncounterAttempt[], sentenceIds: ReadonlySet<string>): number {
  if (sentenceIds.size === 0) return 0;
  let count = 0;
  for (const attempt of attempts) {
    if (attempt.itemType === "sentence" && sentenceIds.has(attempt.itemId)) count += 1;
  }
  return count;
}

export function encounterCounts(
  attempts: EncounterAttempt[],
  sentences: Pick<Sentence, "id" | "vocabIds">[],
): Map<string, number> {
  const byVocab = sentencesByVocab(sentences);
  const counts = new Map<string, number>();
  for (const [vocabId, sentenceIds] of byVocab) {
    counts.set(vocabId, encounterCount(attempts, sentenceIds));
  }
  return counts;
}

export type VocabLookup = Map<string, VocabularyEntry>;

/**
 * Index of every curated surface form to its entry.
 *
 * Only the headword and its authored `forms` are indexed — no stemming. A guessed stem
 * would attach the wrong definition to a word, and showing nothing is better than
 * showing something invented.
 */
export function buildVocabLookup(entries: VocabularyEntry[]): VocabLookup {
  const lookup: VocabLookup = new Map();
  for (const entry of entries) {
    for (const surface of [entry.en, ...entry.forms]) {
      const key = normalizeEnglish(surface);
      if (key.length > 0 && !lookup.has(key)) lookup.set(key, entry);
    }
  }
  return lookup;
}

/** Resolves a tapped word, returning undefined when nothing is curated for it. */
export function lookupWord(lookup: VocabLookup, word: string): VocabularyEntry | undefined {
  return lookup.get(normalizeEnglish(word));
}

/** The meaning authored for this word *in this sentence*, if there is one. */
export function contextualMeaning(entry: VocabularyEntry, sentenceId: string): string | undefined {
  return entry.contexts.find((context) => context.sentenceId === sentenceId)?.meaning;
}
