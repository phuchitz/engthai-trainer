import { getDatabase } from "../client";
import { vocabularyEntrySchema, type VocabularyEntry } from "@/lib/models";

export async function putVocabularyEntry(entry: VocabularyEntry): Promise<VocabularyEntry> {
  const parsed = vocabularyEntrySchema.parse(entry);
  const db = await getDatabase();
  await db.put("vocab", parsed);
  return parsed;
}

export async function putVocabularyEntries(entries: VocabularyEntry[]): Promise<void> {
  const parsed = entries.map((e) => vocabularyEntrySchema.parse(e));
  const db = await getDatabase();
  const tx = db.transaction("vocab", "readwrite");
  await Promise.all(parsed.map((e) => tx.store.put(e)));
  await tx.done;
}

export async function getVocabularyEntry(id: string): Promise<VocabularyEntry | undefined> {
  const db = await getDatabase();
  return db.get("vocab", id);
}

export async function listVocabulary(): Promise<VocabularyEntry[]> {
  const db = await getDatabase();
  return db.getAll("vocab");
}

export async function findVocabularyByEnglish(en: string): Promise<VocabularyEntry[]> {
  const db = await getDatabase();
  return db.getAllFromIndex("vocab", "by-en", en);
}

/** Toggles the learner's saved flag without touching the curated content. */
export async function setVocabularySaved(
  id: string,
  saved: boolean,
  now: number = Date.now(),
): Promise<VocabularyEntry | undefined> {
  const db = await getDatabase();
  const existing = await db.get("vocab", id);
  if (!existing) return undefined;

  const next = vocabularyEntrySchema.parse({ ...existing, saved, updatedAt: now });
  await db.put("vocab", next);
  return next;
}

export async function deleteVocabularyEntry(id: string): Promise<void> {
  const db = await getDatabase();
  await db.delete("vocab", id);
}

export async function countVocabulary(): Promise<number> {
  const db = await getDatabase();
  return db.count("vocab");
}
