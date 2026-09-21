import { z } from "zod";
import {
  attemptSchema,
  lessonSchema,
  sentenceProgressSchema,
  sentenceSchema,
  settingsSchema,
  studySessionSchema,
  vocabularyEntrySchema,
} from "@/lib/models";
import { getDatabase, deleteDatabase } from "@/lib/db/client";
import { DB_VERSION, STORE_NAMES } from "@/lib/db/schema";

/**
 * A backup is a complete, self-describing snapshot: content **and** learning history.
 *
 * `formatVersion` is deliberately separate from the IndexedDB `DB_VERSION`. The database
 * version describes the shape on this device; the format version describes the file, and
 * a file has to stay readable long after the schema behind it has moved on.
 */
export const BACKUP_FORMAT = "engthai-trainer-backup" as const;
export const BACKUP_FORMAT_VERSION = 1;

export const metaRecordSchema = z.object({ key: z.string(), value: z.unknown() });

export const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  formatVersion: z.number().int().positive(),
  exportedAt: z.number().int().nonnegative(),
  /** Recorded for diagnostics; a restore does not depend on it. */
  appDbVersion: z.number().int().positive(),
  data: z.object({
    lessons: z.array(lessonSchema),
    sentences: z.array(sentenceSchema),
    vocab: z.array(vocabularyEntrySchema),
    progress: z.array(sentenceProgressSchema),
    attempts: z.array(attemptSchema),
    sessions: z.array(studySessionSchema),
    settings: z.array(settingsSchema),
    meta: z.array(metaRecordSchema),
  }),
});

export type Backup = z.infer<typeof backupSchema>;

export async function createBackup(now: number = Date.now()): Promise<Backup> {
  const db = await getDatabase();
  const tx = db.transaction(STORE_NAMES, "readonly");

  const [lessons, sentences, vocab, progress, attempts, sessions, settings, meta] = await Promise.all([
    tx.objectStore("lessons").getAll(),
    tx.objectStore("sentences").getAll(),
    tx.objectStore("vocab").getAll(),
    tx.objectStore("progress").getAll(),
    tx.objectStore("attempts").getAll(),
    tx.objectStore("sessions").getAll(),
    tx.objectStore("settings").getAll(),
    tx.objectStore("meta").getAll(),
  ]);
  await tx.done;

  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: now,
    appDbVersion: DB_VERSION,
    data: { lessons, sentences, vocab, progress, attempts, sessions, settings, meta },
  };
}

export function serializeBackup(backup: Backup): string {
  return JSON.stringify(backup, null, 2);
}

export type BackupInspection =
  { ok: true; backup: Backup; counts: Record<string, number> } | { ok: false; errors: string[] };

/**
 * Validates a backup file **completely** before anything is applied.
 *
 * A restore replaces everything, so a half-valid file must be rejected outright rather
 * than partially written: the learner would be left with neither their old data nor a
 * working copy of the new.
 */
export function inspectBackup(text: string): BackupInspection {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return { ok: false, errors: [`That is not valid JSON: ${(error as Error).message}`] };
  }

  const result = backupSchema.safeParse(parsed);
  if (!result.success) {
    const errors = result.error.issues.slice(0, 20).map((issue) => {
      const path = issue.path.join(".");
      return path.length > 0 ? `${path}: ${issue.message}` : issue.message;
    });
    if (result.error.issues.length > 20) {
      errors.push(`…and ${result.error.issues.length - 20} more problems.`);
    }
    return { ok: false, errors };
  }

  if (result.data.formatVersion > BACKUP_FORMAT_VERSION) {
    return {
      ok: false,
      errors: [
        `This backup is format version ${result.data.formatVersion}, but this app understands up to ${BACKUP_FORMAT_VERSION}. Update the app first.`,
      ],
    };
  }

  const { data } = result.data;
  return {
    ok: true,
    backup: result.data,
    counts: {
      lessons: data.lessons.length,
      sentences: data.sentences.length,
      vocabulary: data.vocab.length,
      progress: data.progress.length,
      attempts: data.attempts.length,
      sessions: data.sessions.length,
    },
  };
}

/**
 * Replaces everything with the backup's contents.
 *
 * Every store is cleared and rewritten inside one transaction, so a failure part way
 * through rolls the whole thing back rather than leaving a mixture of two libraries.
 */
export async function restoreBackup(backup: Backup): Promise<void> {
  const db = await getDatabase();
  const tx = db.transaction(STORE_NAMES, "readwrite");

  await Promise.all(STORE_NAMES.map((name) => tx.objectStore(name).clear()));

  const { data } = backup;
  await Promise.all([
    ...data.lessons.map((row) => tx.objectStore("lessons").put(row)),
    ...data.sentences.map((row) => tx.objectStore("sentences").put(row)),
    ...data.vocab.map((row) => tx.objectStore("vocab").put(row)),
    ...data.progress.map((row) => tx.objectStore("progress").put(row)),
    ...data.attempts.map((row) => tx.objectStore("attempts").put(row)),
    ...data.sessions.map((row) => tx.objectStore("sessions").put(row)),
    ...data.settings.map((row) => tx.objectStore("settings").put(row)),
    ...data.meta.map((row) => tx.objectStore("meta").put(row)),
  ]);

  await tx.done;
}

export type DeleteResult = { deleted: true } | { deleted: false; reason: string };

/**
 * Wipes the database and **verifies** it.
 *
 * Reopening and counting afterwards is the point: a delete that quietly failed must
 * never be reported as done.
 */
export async function deleteAllData(): Promise<DeleteResult> {
  try {
    await deleteDatabase();
  } catch (error) {
    return { deleted: false, reason: error instanceof Error ? error.message : String(error) };
  }

  try {
    const db = await getDatabase();
    const remaining = await db.count("sentences");
    const attempts = await db.count("attempts");
    if (remaining > 0 || attempts > 0) {
      return { deleted: false, reason: `${remaining} sentences and ${attempts} attempts are still stored.` };
    }
    return { deleted: true };
  } catch (error) {
    return { deleted: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

export function backupFilename(now: number = Date.now()): string {
  const date = new Date(now);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `engthai-backup-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`;
}
