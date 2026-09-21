import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { deleteDatabase, getDatabase } from "@/lib/db/client";
import { seedDatabase } from "@/lib/db/seed";
import { getSentence, listSentences, putSentence } from "@/lib/db/repositories/sentences";
import { getProgress, listAllProgress } from "@/lib/db/repositories/progress";
import { countAttempts } from "@/lib/db/repositories/attempts";
import { loadSettings, saveSettings } from "@/lib/db/repositories/settings";
import { setVocabularySaved } from "@/lib/db/repositories/vocabulary";
import { submitAnswer } from "@/lib/study";
import {
  BACKUP_FORMAT_VERSION,
  createBackup,
  deleteAllData,
  inspectBackup,
  restoreBackup,
  serializeBackup,
  backupFilename,
} from "@/lib/importexport";
import { progressId } from "@/lib/utils/id";

const NOW = Date.parse("2026-09-21T15:00:00+07:00");
const SENTENCE_ID = "seed-sentence-0002";
const CARD = progressId("sentence", SENTENCE_ID, "th2en");

beforeEach(async () => {
  await deleteDatabase();
  await seedDatabase({ now: NOW });
});

afterEach(async () => {
  await deleteDatabase();
});

/** Produces a database with real learning history, not just seed content. */
async function studySomething() {
  const sentence = (await getSentence(SENTENCE_ID))!;
  await submitAnswer({
    sessionId: "s1",
    sentence,
    mode: "translate",
    direction: "th2en",
    userAnswer: sentence.en,
    durationMs: 4200,
    hintUsed: false,
    ttsUsed: false,
    now: NOW,
  });
  await setVocabularySaved("seed-vocab-hungry", true, NOW);
  await saveSettings({ dailyGoal: 42 }, NOW);
}

describe("createBackup", () => {
  it("is self-describing and versioned", async () => {
    const backup = await createBackup(NOW);
    expect(backup.format).toBe("engthai-trainer-backup");
    expect(backup.formatVersion).toBe(BACKUP_FORMAT_VERSION);
    expect(backup.exportedAt).toBe(NOW);
    expect(backup.appDbVersion).toBeGreaterThan(0);
  });

  it("includes content and learning history", async () => {
    await studySomething();
    const backup = await createBackup(NOW);

    expect(backup.data.sentences.length).toBeGreaterThan(0);
    expect(backup.data.vocab.length).toBeGreaterThan(0);
    expect(backup.data.progress.length).toBeGreaterThan(0);
    expect(backup.data.attempts).toHaveLength(1);
    expect(backup.data.settings).toHaveLength(1);
  });

  it("serializes to JSON that reads back identically", async () => {
    const backup = await createBackup(NOW);
    expect(JSON.parse(serializeBackup(backup))).toEqual(backup);
  });
});

describe("inspectBackup", () => {
  it("accepts a backup this app produced", async () => {
    const text = serializeBackup(await createBackup(NOW));
    const inspection = inspectBackup(text);

    expect(inspection.ok).toBe(true);
    if (inspection.ok) expect(inspection.counts.sentences).toBeGreaterThan(0);
  });

  it("rejects text that is not JSON", () => {
    const inspection = inspectBackup("{nope");
    expect(inspection.ok).toBe(false);
    if (!inspection.ok) expect(inspection.errors[0]).toMatch(/not valid JSON/);
  });

  it("rejects a lesson file that is not a backup", () => {
    const inspection = inspectBackup('[{"english":"hi","thai":"สวัสดี"}]');
    expect(inspection.ok).toBe(false);
  });

  it("rejects a backup with a corrupted row rather than half-applying it", async () => {
    const backup = await createBackup(NOW);
    const broken = JSON.parse(serializeBackup(backup));
    broken.data.sentences[0].level = "Z9";

    const inspection = inspectBackup(JSON.stringify(broken));
    expect(inspection.ok).toBe(false);
    if (!inspection.ok) expect(inspection.errors.join(" ")).toMatch(/sentences/);
  });

  it("refuses a format version newer than this app understands", async () => {
    const backup = await createBackup(NOW);
    const future = { ...backup, formatVersion: BACKUP_FORMAT_VERSION + 1 };

    const inspection = inspectBackup(JSON.stringify(future));
    expect(inspection.ok).toBe(false);
    if (!inspection.ok) expect(inspection.errors[0]).toMatch(/Update the app first/);
  });
});

describe("backup round trip", () => {
  it("reproduces the same state after a wipe", async () => {
    await studySomething();

    const before = {
      sentences: await listSentences(),
      progress: await listAllProgress(),
      attempts: await countAttempts(),
      settings: await loadSettings(NOW),
      card: await getProgress(CARD),
    };

    const text = serializeBackup(await createBackup(NOW));

    // Wipe everything, then restore from the file.
    await deleteDatabase();
    await getDatabase();
    expect(await listSentences()).toHaveLength(0);

    const inspection = inspectBackup(text);
    expect(inspection.ok).toBe(true);
    if (!inspection.ok) return;
    await restoreBackup(inspection.backup);

    expect(await listSentences()).toEqual(before.sentences);
    expect(await listAllProgress()).toEqual(before.progress);
    expect(await countAttempts()).toBe(before.attempts);
    expect(await loadSettings(NOW)).toEqual(before.settings);
    expect(await getProgress(CARD)).toEqual(before.card);
  });

  it("preserves the schedule exactly, not just the sentence text", async () => {
    await studySomething();
    const card = await getProgress(CARD);
    expect(card?.practiceCount).toBe(1);

    const text = serializeBackup(await createBackup(NOW));
    await deleteDatabase();
    await getDatabase();

    const inspection = inspectBackup(text);
    if (!inspection.ok) throw new Error("backup should be valid");
    await restoreBackup(inspection.backup);

    const restored = await getProgress(CARD);
    expect(restored?.practiceCount).toBe(1);
    expect(restored?.nextReviewAt).toBe(card?.nextReviewAt);
    expect(restored?.intervalDays).toBe(card?.intervalDays);
  });

  it("replaces rather than merges, so restoring drops anything added since", async () => {
    const text = serializeBackup(await createBackup(NOW));

    await putSentence({
      id: "added-later",
      en: "Added after the backup.",
      th: "เพิ่มทีหลัง",
      enAlternates: [],
      thAlternates: [],
      tags: [],
      category: "custom",
      level: "A1",
      lessonIds: [],
      vocabIds: [],
      source: "user",
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(await getSentence("added-later")).toBeDefined();

    const inspection = inspectBackup(text);
    if (!inspection.ok) throw new Error("backup should be valid");
    await restoreBackup(inspection.backup);

    expect(await getSentence("added-later")).toBeUndefined();
  });

  it("survives a second round trip unchanged", async () => {
    await studySomething();
    const first = serializeBackup(await createBackup(NOW));

    const inspection = inspectBackup(first);
    if (!inspection.ok) throw new Error("backup should be valid");
    await restoreBackup(inspection.backup);

    const second = serializeBackup(await createBackup(NOW));
    expect(second).toBe(first);
  });
});

describe("deleteAllData", () => {
  it("removes everything and confirms it", async () => {
    await studySomething();
    expect(await listSentences()).not.toHaveLength(0);

    const result = await deleteAllData();

    expect(result).toEqual({ deleted: true });
    expect(await listSentences()).toHaveLength(0);
    expect(await countAttempts()).toBe(0);
  });

  it("verifies by reopening, so a silent failure is not reported as success", async () => {
    // The check is a real read-back: after a successful delete the stores are empty.
    await deleteAllData();
    const db = await getDatabase();
    expect(await db.count("sentences")).toBe(0);
  });
});

describe("backupFilename", () => {
  it("is dated and ends in .json", () => {
    expect(backupFilename(NOW)).toMatch(/^engthai-backup-\d{4}-\d{2}-\d{2}\.json$/);
  });
});
