import { getDatabase } from "./client";
import { getMeta, setMeta } from "./repositories/meta";
import { ensureProgressForItem } from "./repositories/progress";
import { SEED_LESSONS, SEED_SENTENCES, SEED_VERSION, SEED_VOCABULARY } from "@/content/seed/starter";
import { lessonSchema, sentenceSchema, vocabularyEntrySchema } from "@/lib/models";

export const SEED_META_KEY = "seed";

export type SeedState = {
  version: number;
  appliedAt: number;
};

export type SeedResult = {
  /** False when the stored seed version is already current and nothing was written. */
  applied: boolean;
  lessonsAdded: number;
  sentencesAdded: number;
  vocabularyAdded: number;
  progressCreated: number;
};

const NOTHING: Omit<SeedResult, "applied"> = {
  lessonsAdded: 0,
  sentencesAdded: 0,
  vocabularyAdded: 0,
  progressCreated: 0,
};

/**
 * Loads the built-in deck.
 *
 * Idempotent in two layers: the stored seed version short-circuits a repeat run, and
 * every write is insert-if-absent, so a learner who edited a built-in sentence keeps
 * their edit even when a newer seed version ships.
 */
export async function seedDatabase(options: { force?: boolean; now?: number } = {}): Promise<SeedResult> {
  const now = options.now ?? Date.now();
  const state = await getMeta<SeedState>(SEED_META_KEY);

  if (!options.force && state && state.version >= SEED_VERSION) {
    return { applied: false, ...NOTHING };
  }

  const db = await getDatabase();
  const result: SeedResult = { applied: true, ...NOTHING };

  const tx = db.transaction(["lessons", "sentences", "vocab"], "readwrite");

  for (const lesson of SEED_LESSONS) {
    if (await tx.objectStore("lessons").get(lesson.id)) continue;
    await tx
      .objectStore("lessons")
      .put(lessonSchema.parse({ ...lesson, source: "builtin", createdAt: now, updatedAt: now }));
    result.lessonsAdded += 1;
  }

  for (const sentence of SEED_SENTENCES) {
    if (await tx.objectStore("sentences").get(sentence.id)) continue;
    await tx
      .objectStore("sentences")
      .put(sentenceSchema.parse({ ...sentence, source: "builtin", createdAt: now, updatedAt: now }));
    result.sentencesAdded += 1;
  }

  for (const entry of SEED_VOCABULARY) {
    if (await tx.objectStore("vocab").get(entry.id)) continue;
    await tx
      .objectStore("vocab")
      .put(vocabularyEntrySchema.parse({ ...entry, source: "builtin", createdAt: now, updatedAt: now }));
    result.vocabularyAdded += 1;
  }

  await tx.done;

  // Runs outside the transaction above: progress rows are keyed deterministically,
  // so re-running only fills gaps and never duplicates.
  for (const sentence of SEED_SENTENCES) {
    result.progressCreated += await ensureProgressForItem("sentence", sentence.id, now);
  }
  for (const entry of SEED_VOCABULARY) {
    result.progressCreated += await ensureProgressForItem("vocab", entry.id, now);
  }

  await setMeta(SEED_META_KEY, { version: SEED_VERSION, appliedAt: now } satisfies SeedState);

  return result;
}
