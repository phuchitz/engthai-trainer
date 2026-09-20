import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getDatabase, deleteDatabase } from "@/lib/db/client";
import { STORE_NAMES } from "@/lib/db/schema";
import { putLesson, getLesson, listLessons, deleteLesson } from "@/lib/db/repositories/lessons";
import {
  putSentence,
  putSentences,
  getSentence,
  getSentences,
  listSentencesByLesson,
  listSentencesByTag,
  countSentences,
} from "@/lib/db/repositories/sentences";
import { putVocabularyEntry, findVocabularyByEnglish } from "@/lib/db/repositories/vocabulary";
import {
  ensureProgressForItem,
  getProgress,
  listProgressForItem,
  listDueProgress,
  putProgress,
  newProgress,
} from "@/lib/db/repositories/progress";
import { addAttempt, listAttemptsForSession, listAttemptsInRange } from "@/lib/db/repositories/attempts";
import { loadSettings, saveSettings } from "@/lib/db/repositories/settings";
import { getMeta, setMeta } from "@/lib/db/repositories/meta";
import { progressId } from "@/lib/utils/id";
import type { Sentence } from "@/lib/models";

const NOW = 1_700_000_000_000;
const DAY = 86_400_000;

function sentence(id: string, over: Partial<Sentence> = {}): Sentence {
  return {
    id,
    en: "I am very hungry.",
    th: "ฉันหิวมาก",
    enAlternates: [],
    thAlternates: [],
    tags: ["everyday"],
    level: "A1",
    lessonIds: ["l1"],
    vocabIds: [],
    source: "builtin",
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  };
}

beforeEach(async () => {
  await deleteDatabase();
});

afterEach(async () => {
  await deleteDatabase();
});

describe("database schema", () => {
  it("creates every declared store", async () => {
    const db = await getDatabase();
    for (const name of STORE_NAMES) {
      expect(Array.from(db.objectStoreNames)).toContain(name);
    }
  });

  it("creates the indexes the repositories query through", async () => {
    const db = await getDatabase();
    const tx = db.transaction(["sentences", "progress", "attempts"], "readonly");
    expect(Array.from(tx.objectStore("sentences").indexNames).sort()).toEqual([
      "by-lesson",
      "by-level",
      "by-source",
      "by-tag",
    ]);
    expect(Array.from(tx.objectStore("progress").indexNames).sort()).toEqual([
      "by-due",
      "by-item",
      "by-next-review",
    ]);
    expect(Array.from(tx.objectStore("attempts").indexNames).sort()).toEqual([
      "by-created",
      "by-progress",
      "by-session",
    ]);
    await tx.done;
  });

  it("reuses the same connection across calls", async () => {
    expect(await getDatabase()).toBe(await getDatabase());
  });
});

describe("sentence repository", () => {
  it("round-trips a record", async () => {
    await putSentence(sentence("s1"));
    const found = await getSentence("s1");
    expect(found?.th).toBe("ฉันหิวมาก");
  });

  it("returns undefined for a missing id", async () => {
    expect(await getSentence("nope")).toBeUndefined();
  });

  it("updates in place rather than duplicating", async () => {
    await putSentence(sentence("s1"));
    await putSentence(sentence("s1", { en: "I'm starving." }));
    expect(await countSentences()).toBe(1);
    expect((await getSentence("s1"))?.en).toBe("I'm starving.");
  });

  it("rejects an invalid record before it reaches the store", async () => {
    await expect(putSentence(sentence("s1", { th: "" }))).rejects.toThrow();
    expect(await countSentences()).toBe(0);
  });

  it("writes a batch in one transaction", async () => {
    await putSentences([sentence("s1"), sentence("s2"), sentence("s3")]);
    expect(await countSentences()).toBe(3);
  });

  it("skips missing ids when fetching many", async () => {
    await putSentences([sentence("s1"), sentence("s2")]);
    const found = await getSentences(["s1", "missing", "s2"]);
    expect(found.map((s) => s.id)).toEqual(["s1", "s2"]);
  });

  it("queries by lesson and by tag through the multi-entry indexes", async () => {
    await putSentences([
      sentence("s1", { lessonIds: ["l1"], tags: ["everyday"] }),
      sentence("s2", { lessonIds: ["l2"], tags: ["time"] }),
    ]);
    expect((await listSentencesByLesson("l1")).map((s) => s.id)).toEqual(["s1"]);
    expect((await listSentencesByTag("time")).map((s) => s.id)).toEqual(["s2"]);
  });

  it("deletes a record", async () => {
    await putSentence(sentence("s1"));
    const db = await getDatabase();
    await db.delete("sentences", "s1");
    expect(await getSentence("s1")).toBeUndefined();
  });
});

describe("lesson and vocabulary repositories", () => {
  it("round-trips a lesson and deletes it", async () => {
    await putLesson({
      id: "l1",
      title: "Everyday Basics",
      titleTh: "พื้นฐานประจำวัน",
      tags: [],
      level: "A1",
      sentenceIds: ["s1"],
      source: "builtin",
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect((await getLesson("l1"))?.titleTh).toBe("พื้นฐานประจำวัน");
    expect(await listLessons()).toHaveLength(1);
    await deleteLesson("l1");
    expect(await listLessons()).toHaveLength(0);
  });

  it("finds vocabulary by its English headword", async () => {
    await putVocabularyEntry({
      id: "v1",
      en: "hungry",
      th: "หิว",
      exampleSentenceIds: [],
      tags: [],
      level: "A1",
      source: "builtin",
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect((await findVocabularyByEnglish("hungry")).map((v) => v.th)).toEqual(["หิว"]);
  });
});

describe("progress repository", () => {
  it("creates one row per direction", async () => {
    expect(await ensureProgressForItem("sentence", "s1", NOW)).toBe(2);
    const rows = await listProgressForItem("sentence", "s1");
    expect(rows.map((r) => r.direction).sort()).toEqual(["en2th", "th2en"]);
  });

  it("is idempotent and does not overwrite existing scheduling state", async () => {
    await ensureProgressForItem("sentence", "s1", NOW);
    const id = progressId("sentence", "s1", "en2th");
    const existing = await getProgress(id);
    await putProgress({ ...existing!, practiceCount: 9, stability: 12.5 });

    expect(await ensureProgressForItem("sentence", "s1", NOW + DAY)).toBe(0);
    const after = await getProgress(id);
    expect(after?.practiceCount).toBe(9);
    expect(after?.stability).toBe(12.5);
  });

  it("schedules the two directions independently", async () => {
    await ensureProgressForItem("sentence", "s1", NOW);
    const forward = (await getProgress(progressId("sentence", "s1", "en2th")))!;
    await putProgress({ ...forward, nextReviewAt: NOW + 30 * DAY });

    const due = await listDueProgress(NOW);
    expect(due.map((p) => p.direction)).toEqual(["th2en"]);
  });

  it("excludes suspended rows from the due queue", async () => {
    await ensureProgressForItem("sentence", "s1", NOW);
    const row = (await getProgress(progressId("sentence", "s1", "en2th")))!;
    await putProgress({ ...row, suspended: true });
    expect((await listDueProgress(NOW)).map((p) => p.direction)).toEqual(["th2en"]);
  });

  it("excludes rows scheduled in the future", async () => {
    await putProgress({ ...newProgress("sentence", "s1", "en2th", NOW), nextReviewAt: NOW + DAY });
    expect(await listDueProgress(NOW)).toHaveLength(0);
    expect(await listDueProgress(NOW + DAY)).toHaveLength(1);
  });

  it("honours a queue limit", async () => {
    await ensureProgressForItem("sentence", "s1", NOW);
    await ensureProgressForItem("sentence", "s2", NOW);
    expect(await listDueProgress(NOW, 3)).toHaveLength(3);
  });
});

describe("attempt repository", () => {
  const attempt = (id: string, createdAt: number) => ({
    id,
    sessionId: "sess1",
    progressId: progressId("sentence", "s1", "en2th"),
    itemType: "sentence" as const,
    itemId: "s1",
    direction: "en2th" as const,
    mode: "translate" as const,
    prompt: "I am very hungry.",
    userAnswer: "ฉันหิวมาก",
    expectedAnswer: "ฉันหิวมาก",
    verdict: "correct" as const,
    grade: 3 as const,
    similarity: 1,
    durationMs: 4200,
    hintUsed: false,
    ttsUsed: false,
    createdAt,
  });

  it("appends and queries by session", async () => {
    await addAttempt(attempt("a1", NOW));
    await addAttempt(attempt("a2", NOW + 1000));
    expect(await listAttemptsForSession("sess1")).toHaveLength(2);
  });

  it("refuses to overwrite an existing attempt", async () => {
    await addAttempt(attempt("a1", NOW));
    await expect(addAttempt(attempt("a1", NOW + 1))).rejects.toThrow();
  });

  it("queries a time range for the heatmap", async () => {
    await addAttempt(attempt("a1", NOW));
    await addAttempt(attempt("a2", NOW + 5 * DAY));
    expect(await listAttemptsInRange(NOW, NOW + DAY)).toHaveLength(1);
  });
});

describe("settings repository", () => {
  it("creates defaults on first read", async () => {
    expect((await loadSettings(NOW)).dailyGoal).toBe(20);
  });

  it("persists a patch without discarding the rest", async () => {
    await loadSettings(NOW);
    const saved = await saveSettings({ dailyGoal: 35 }, NOW + 1000);
    expect(saved.dailyGoal).toBe(35);
    expect(saved.newPerDay).toBe(10);
    expect(saved.updatedAt).toBe(NOW + 1000);
    expect((await loadSettings()).dailyGoal).toBe(35);
  });

  it("rejects a patch that violates the schema", async () => {
    await expect(saveSettings({ dailyGoal: 9999 })).rejects.toThrow();
  });
});

describe("meta repository", () => {
  it("stores and reads arbitrary values", async () => {
    await setMeta("seed", { version: 3 });
    expect(await getMeta<{ version: number }>("seed")).toEqual({ version: 3 });
    expect(await getMeta("absent")).toBeUndefined();
  });
});
