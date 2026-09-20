import { getDatabase } from "../client";
import { progressId } from "@/lib/utils/id";
import {
  emptyMistakesByMode,
  sentenceProgressSchema,
  type Direction,
  type ItemType,
  type SentenceProgress,
} from "@/lib/models";

export function newProgress(
  itemType: ItemType,
  itemId: string,
  direction: Direction,
  now: number,
): SentenceProgress {
  return sentenceProgressSchema.parse({
    id: progressId(itemType, itemId, direction),
    itemType,
    itemId,
    direction,
    nextReviewAt: now,
    mistakesByMode: emptyMistakesByMode(),
    createdAt: now,
    updatedAt: now,
  });
}

export async function putProgress(progress: SentenceProgress): Promise<SentenceProgress> {
  const parsed = sentenceProgressSchema.parse(progress);
  const db = await getDatabase();
  await db.put("progress", parsed);
  return parsed;
}

export async function getProgress(id: string): Promise<SentenceProgress | undefined> {
  const db = await getDatabase();
  return db.get("progress", id);
}

export async function listProgressForItem(itemType: ItemType, itemId: string): Promise<SentenceProgress[]> {
  const db = await getDatabase();
  return db.getAllFromIndex("progress", "by-item", [itemType, itemId]);
}

export async function listAllProgress(): Promise<SentenceProgress[]> {
  const db = await getDatabase();
  return db.getAll("progress");
}

/**
 * Rows due at or before `now`, excluding suspended ones.
 *
 * `suspended` is filtered in memory rather than indexed because IndexedDB cannot use a
 * boolean as a key, and a single learner's row count stays small enough that it is free.
 */
export async function listDueProgress(now: number, limit?: number): Promise<SentenceProgress[]> {
  const db = await getDatabase();
  const due = await db.getAllFromIndex("progress", "by-next-review", IDBKeyRange.upperBound(now));
  const active = due.filter((p) => !p.suspended);
  return typeof limit === "number" ? active.slice(0, limit) : active;
}

export async function countDueProgress(now: number): Promise<number> {
  return (await listDueProgress(now)).length;
}

/** Creates progress rows for both directions, leaving any that already exist untouched. */
export async function ensureProgressForItem(
  itemType: ItemType,
  itemId: string,
  now: number,
): Promise<number> {
  const db = await getDatabase();
  const tx = db.transaction("progress", "readwrite");
  let created = 0;
  for (const direction of ["en2th", "th2en"] as const) {
    const id = progressId(itemType, itemId, direction);
    if (await tx.store.get(id)) continue;
    await tx.store.put(newProgress(itemType, itemId, direction, now));
    created += 1;
  }
  await tx.done;
  return created;
}

export async function deleteProgress(id: string): Promise<void> {
  const db = await getDatabase();
  await db.delete("progress", id);
}

export async function countProgress(): Promise<number> {
  const db = await getDatabase();
  return db.count("progress");
}
