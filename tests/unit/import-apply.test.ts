import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { deleteDatabase } from "@/lib/db/client";
import { getSentence, listSentences, putSentence } from "@/lib/db/repositories/sentences";
import { listVocabulary } from "@/lib/db/repositories/vocabulary";
import { getProgress, newProgress, putProgress } from "@/lib/db/repositories/progress";
import { addAttempt } from "@/lib/db/repositories/attempts";
import { listAttemptsForProgress } from "@/lib/db/repositories/attempts";
import {
  applyImportPlan,
  buildImportPlan,
  loadExistingForDuplicates,
  readSource,
  summarize,
} from "@/lib/importexport";
import { attemptSchema, type Sentence } from "@/lib/models";
import { progressId } from "@/lib/utils/id";

const NOW = 1_700_000_000_000;
const DAY = 86_400_000;

async function stored(id: string, en: string, over: Partial<Sentence> = {}): Promise<Sentence> {
  const row: Sentence = {
    id,
    en,
    th: "ประโยคเดิม",
    enAlternates: [],
    thAlternates: [],
    tags: [],
    category: "daily",
    level: "A1",
    lessonIds: [],
    vocabIds: [],
    source: "builtin",
    createdAt: NOW - 10 * DAY,
    updatedAt: NOW - 10 * DAY,
    ...over,
  };
  await putSentence(row);
  return row;
}

/** Builds the plan the preview screen would show for this file. */
async function plan(format: "json" | "csv" | "paste", text: string) {
  return buildImportPlan(readSource(format, text), await loadExistingForDuplicates());
}

beforeEach(async () => {
  await deleteDatabase();
});

afterEach(async () => {
  await deleteDatabase();
});

describe("writing new sentences", () => {
  it("creates a sentence, its progress rows and its vocabulary", async () => {
    const file = JSON.stringify([
      {
        english: "I am very hungry.",
        thai: "ฉันหิวมาก",
        level: "A1",
        category: "daily",
        vocabulary: [
          { en: "hungry", th: "หิว" },
          { en: "very", th: "มาก" },
        ],
        grammarExplanation: "ไม่ต้องมี verb to be",
        examples: [{ en: "I am very tired.", th: "ฉันเหนื่อยมาก" }],
        acceptedAnswers: ["I'm very hungry."],
      },
    ]);

    const result = await applyImportPlan(await plan("json", file), "skip", NOW);

    expect(result).toMatchObject({ created: 1, updated: 0, skipped: 0, vocabularyCreated: 2 });
    // A card per direction, so the sentence is studiable in both immediately.
    expect(result.progressCreated).toBe(2);

    const [sentence] = await listSentences();
    expect(sentence.en).toBe("I am very hungry.");
    expect(sentence.enAlternates).toEqual(["I'm very hungry."]);
    expect(sentence.notes).toBe("ไม่ต้องมี verb to be");
    expect(sentence.exampleEn).toBe("I am very tired.");
    expect(sentence.source).toBe("imported");
    expect(sentence.vocabIds).toHaveLength(2);
  });

  it("marks imported vocabulary as imported and unsaved", async () => {
    await applyImportPlan(await plan("paste", "Where are you going?\tคุณจะไปไหน"), "skip", NOW);
    await applyImportPlan(
      await plan(
        "json",
        JSON.stringify([{ english: "Hello.", thai: "สวัสดี", vocabulary: [{ en: "hello", th: "สวัสดี" }] }]),
      ),
      "skip",
      NOW,
    );

    const [word] = await listVocabulary();
    expect(word.source).toBe("imported");
    expect(word.saved).toBe(false);
  });

  it("writes nothing for a file whose every row is rejected", async () => {
    const file = JSON.stringify([{ english: "", thai: "" }]);
    const built = await plan("json", file);

    expect(built.rejected).toHaveLength(1);
    expect(await applyImportPlan(built, "skip", NOW)).toMatchObject({ created: 0, skipped: 0 });
    expect(await listSentences()).toHaveLength(0);
  });

  it("stores only the first of several examples, having warned about it", async () => {
    const file = JSON.stringify([
      {
        english: "Hello.",
        thai: "สวัสดี",
        examples: [
          { en: "Hi.", th: "หวัดดี" },
          { en: "Good day.", th: "สวัสดีตอนกลางวัน" },
        ],
      },
    ]);
    const built = await plan("json", file);
    expect(built.accepted[0].warnings.join(" ")).toMatch(/only the first of 2 examples/);

    await applyImportPlan(built, "skip", NOW);
    const [sentence] = await listSentences();
    expect(sentence.exampleEn).toBe("Hi.");
  });
});

describe("duplicate detection", () => {
  it("matches on normalized English, so punctuation and case do not hide a duplicate", async () => {
    await stored("existing", "Where are you going?");

    const built = await plan("paste", "where are you going\tคุณจะไปไหน");
    expect(built.create).toHaveLength(0);
    expect(built.duplicates).toHaveLength(1);
    expect(built.duplicates[0].duplicateOf).toEqual({ kind: "existing", sentenceId: "existing" });
  });

  it("catches a file that repeats itself", async () => {
    const built = await plan("paste", "Hello.\tสวัสดี\nHello!\tสวัสดีครับ");

    expect(built.create).toHaveLength(1);
    expect(built.duplicates[0].duplicateOf).toEqual({ kind: "file", line: 1 });
  });

  it("skips duplicates by default and leaves the stored sentence untouched", async () => {
    await stored("existing", "Where are you going?", { th: "คุณจะไปไหน" });

    const result = await applyImportPlan(
      await plan("paste", "Where are you going?\tเธอจะไปไหน"),
      "skip",
      NOW,
    );

    expect(result).toMatchObject({ created: 0, updated: 0, skipped: 1 });
    expect((await getSentence("existing"))?.th).toBe("คุณจะไปไหน");
    expect(await listSentences()).toHaveLength(1);
  });

  it("never writes a within-file duplicate, even in update mode", async () => {
    // There is no distinct stored sentence to update, so writing it would create the
    // second copy the detection exists to prevent.
    const result = await applyImportPlan(
      await plan("paste", "Hello.\tสวัสดี\nHello.\tหวัดดี"),
      "update",
      NOW,
    );

    expect(result).toMatchObject({ created: 1, updated: 0, skipped: 1 });
    expect(await listSentences()).toHaveLength(1);
  });

  it("reports in the preview how many rows a run would actually write", async () => {
    await stored("existing", "Hello.");
    const built = await plan("paste", "Hello.\tสวัสดี\nGoodbye.\tลาก่อน");

    expect(summarize(built, "skip")).toMatchObject({ total: 2, create: 1, duplicates: 1, willWrite: 1 });
    expect(summarize(built, "update")).toMatchObject({ willWrite: 2 });
  });
});

describe("updating a duplicate preserves learning history", () => {
  it("reuses the existing sentence id", async () => {
    await stored("existing", "Where are you going?");

    const result = await applyImportPlan(
      await plan("paste", "Where are you going?\tเธอจะไปไหนจ๊ะ"),
      "update",
      NOW,
    );

    expect(result).toMatchObject({ created: 0, updated: 1, skipped: 0 });
    expect(await listSentences()).toHaveLength(1);

    const sentence = await getSentence("existing");
    expect(sentence?.th).toBe("เธอจะไปไหนจ๊ะ");
  });

  it("leaves the schedule exactly where it was", async () => {
    await stored("existing", "Where are you going?");
    const rowId = progressId("sentence", "existing", "th2en");
    await putProgress({
      ...newProgress("sentence", "existing", "th2en", NOW),
      practiceCount: 6,
      correctCount: 5,
      incorrectCount: 1,
      intervalDays: 12,
      nextReviewAt: NOW + 12 * DAY,
    });

    await applyImportPlan(await plan("paste", "Where are you going?\tเธอจะไปไหน"), "update", NOW);

    const progress = await getProgress(rowId);
    expect(progress?.practiceCount).toBe(6);
    expect(progress?.intervalDays).toBe(12);
    expect(progress?.nextReviewAt).toBe(NOW + 12 * DAY);
  });

  it("leaves the answer log intact", async () => {
    await stored("existing", "Where are you going?");
    const rowId = progressId("sentence", "existing", "th2en");
    await addAttempt(
      attemptSchema.parse({
        id: "a1",
        sessionId: "sess",
        progressId: rowId,
        itemType: "sentence",
        itemId: "existing",
        direction: "th2en",
        mode: "translate",
        prompt: "คุณจะไปไหน",
        userAnswer: "where are you going",
        expectedAnswer: "Where are you going?",
        verdict: "correct",
        grade: 3,
        xpAwarded: 10,
        createdAt: NOW - DAY,
      }),
    );

    await applyImportPlan(await plan("paste", "Where are you going?\tเธอจะไปไหน"), "update", NOW);

    expect(await listAttemptsForProgress(rowId)).toHaveLength(1);
  });

  it("keeps the original createdAt while moving updatedAt forward", async () => {
    await stored("existing", "Hello.");
    await applyImportPlan(await plan("paste", "Hello.\tสวัสดีครับ"), "update", NOW);

    const sentence = await getSentence("existing");
    expect(sentence?.createdAt).toBe(NOW - 10 * DAY);
    expect(sentence?.updatedAt).toBe(NOW);
  });

  it("adds imported vocabulary to what the sentence already had, rather than replacing it", async () => {
    await stored("existing", "Hello.", { vocabIds: ["curated-1"] });

    await applyImportPlan(
      await plan(
        "json",
        JSON.stringify([{ english: "Hello.", thai: "สวัสดี", vocabulary: [{ en: "hello", th: "สวัสดี" }] }]),
      ),
      "update",
      NOW,
    );

    const sentence = await getSentence("existing");
    expect(sentence?.vocabIds).toHaveLength(2);
    expect(sentence?.vocabIds).toContain("curated-1");
  });

  it("skips rather than invents a row when the matched sentence has since been deleted", async () => {
    await stored("existing", "Hello.");
    const built = await plan("paste", "Hello.\tสวัสดี");

    const { deleteSentence } = await import("@/lib/db/repositories/sentences");
    await deleteSentence("existing");

    const result = await applyImportPlan(built, "update", NOW);
    expect(result).toMatchObject({ created: 0, updated: 0, skipped: 1 });
    expect(await listSentences()).toHaveLength(0);
  });
});

describe("a fatal file writes nothing at all", () => {
  it("reports the problem and leaves the database alone", async () => {
    await stored("existing", "Hello.");
    const built = await plan("json", "{ not json");

    expect(built.fatal).toBeTruthy();
    expect(await applyImportPlan(built, "update", NOW)).toMatchObject({ created: 0, updated: 0 });
    expect(await listSentences()).toHaveLength(1);
  });
});
