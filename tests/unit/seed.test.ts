import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { deleteDatabase } from "@/lib/db/client";
import { seedDatabase, SEED_META_KEY, type SeedState } from "@/lib/db/seed";
import { SEED_SENTENCES, SEED_VERSION, SEED_VOCABULARY, SEED_LESSONS } from "@/content/seed/starter";
import { countSentences, getSentence, putSentence } from "@/lib/db/repositories/sentences";
import { countVocabulary } from "@/lib/db/repositories/vocabulary";
import { countLessons } from "@/lib/db/repositories/lessons";
import { countProgress, listProgressForItem } from "@/lib/db/repositories/progress";
import { getMeta, setMeta } from "@/lib/db/repositories/meta";

const NOW = 1_700_000_000_000;

beforeEach(async () => {
  await deleteDatabase();
});

afterEach(async () => {
  await deleteDatabase();
});

describe("seedDatabase", () => {
  it("loads the starter deck on a fresh database", async () => {
    const result = await seedDatabase({ now: NOW });
    expect(result.applied).toBe(true);
    expect(result.lessonsAdded).toBe(SEED_LESSONS.length);
    expect(result.sentencesAdded).toBe(SEED_SENTENCES.length);
    expect(result.vocabularyAdded).toBe(SEED_VOCABULARY.length);
    expect(await countSentences()).toBe(SEED_SENTENCES.length);
    expect(await countVocabulary()).toBe(SEED_VOCABULARY.length);
    expect(await countLessons()).toBe(SEED_LESSONS.length);
  });

  it("creates progress rows for both directions of every seeded item", async () => {
    await seedDatabase({ now: NOW });
    const items = SEED_SENTENCES.length + SEED_VOCABULARY.length;
    expect(await countProgress()).toBe(items * 2);
    expect(await listProgressForItem("sentence", SEED_SENTENCES[0].id)).toHaveLength(2);
  });

  it("marks the applied seed version", async () => {
    await seedDatabase({ now: NOW });
    const state = await getMeta<SeedState>(SEED_META_KEY);
    expect(state).toEqual({ version: SEED_VERSION, appliedAt: NOW });
  });

  it("is a no-op on a second run", async () => {
    await seedDatabase({ now: NOW });
    const second = await seedDatabase({ now: NOW + 5000 });

    expect(second.applied).toBe(false);
    expect(second.sentencesAdded).toBe(0);
    expect(second.progressCreated).toBe(0);
    expect(await countSentences()).toBe(SEED_SENTENCES.length);
    expect(await countProgress()).toBe((SEED_SENTENCES.length + SEED_VOCABULARY.length) * 2);
  });

  it("does not duplicate rows when run repeatedly", async () => {
    await seedDatabase({ now: NOW });
    await seedDatabase({ now: NOW });
    await seedDatabase({ now: NOW });
    expect(await countSentences()).toBe(SEED_SENTENCES.length);
    expect(await countLessons()).toBe(SEED_LESSONS.length);
  });

  it("keeps a learner's edit to a built-in sentence when a newer seed version ships", async () => {
    await seedDatabase({ now: NOW });
    const edited = (await getSentence(SEED_SENTENCES[0].id))!;
    await putSentence({ ...edited, en: "My own wording.", source: "user" });

    // Simulate an older applied version so the loader runs again.
    await setMeta(SEED_META_KEY, { version: SEED_VERSION - 1, appliedAt: NOW });
    const result = await seedDatabase({ now: NOW + 10_000 });

    expect(result.applied).toBe(true);
    expect(result.sentencesAdded).toBe(0);
    expect((await getSentence(SEED_SENTENCES[0].id))?.en).toBe("My own wording.");
  });

  it("refills only what is missing after a row is deleted", async () => {
    await seedDatabase({ now: NOW });
    const target = SEED_SENTENCES[1].id;
    const { deleteSentence } = await import("@/lib/db/repositories/sentences");
    await deleteSentence(target);

    const result = await seedDatabase({ now: NOW, force: true });
    expect(result.sentencesAdded).toBe(1);
    expect(result.progressCreated).toBe(0);
    expect(await countSentences()).toBe(SEED_SENTENCES.length);
  });

  it("re-runs when forced even though the version already matches", async () => {
    await seedDatabase({ now: NOW });
    expect((await seedDatabase({ now: NOW, force: true })).applied).toBe(true);
  });
});

describe("upgrading a database that already holds the previous deck", () => {
  /** A learner mid-way through the old six-sentence deck. */
  async function studyOneSentence(id: string) {
    const { getProgress, putProgress } = await import("@/lib/db/repositories/progress");
    const { progressId } = await import("@/lib/utils/id");
    const rowId = progressId("sentence", id, "th2en");
    const row = (await getProgress(rowId))!;
    await putProgress({
      ...row,
      practiceCount: 4,
      correctCount: 3,
      incorrectCount: 1,
      intervalDays: 6,
      nextReviewAt: NOW + 6 * 86_400_000,
      lastPracticedAt: NOW,
    });
    return rowId;
  }

  it("adds the new sentences and leaves the old rows' schedules untouched", async () => {
    await seedDatabase({ now: NOW });
    const rowId = await studyOneSentence(SEED_SENTENCES[0].id);

    // Pretend the stored deck is one version behind, which is what a returning
    // learner's database actually looks like after an update ships.
    await setMeta(SEED_META_KEY, { version: SEED_VERSION - 1, appliedAt: NOW });
    const result = await seedDatabase({ now: NOW + 86_400_000 });

    expect(result.applied).toBe(true);
    expect(result.sentencesAdded).toBe(0);
    // Refreshed in place, not inserted again.
    expect(result.sentencesRefreshed).toBe(SEED_SENTENCES.length);
    expect(await countSentences()).toBe(SEED_SENTENCES.length);

    const { getProgress } = await import("@/lib/db/repositories/progress");
    const progress = await getProgress(rowId);
    expect(progress?.practiceCount).toBe(4);
    expect(progress?.intervalDays).toBe(6);
    expect(progress?.nextReviewAt).toBe(NOW + 6 * 86_400_000);
  });

  it("keeps the original createdAt when a sentence is refreshed", async () => {
    await seedDatabase({ now: NOW });
    await setMeta(SEED_META_KEY, { version: SEED_VERSION - 1, appliedAt: NOW });
    await seedDatabase({ now: NOW + 86_400_000 });

    const sentence = await getSentence(SEED_SENTENCES[0].id);
    expect(sentence?.createdAt).toBe(NOW);
    expect(sentence?.updatedAt).toBe(NOW + 86_400_000);
  });

  it("keeps a word the learner saved when its definition improves", async () => {
    await seedDatabase({ now: NOW });
    const { getVocabularyEntry, putVocabularyEntry } = await import("@/lib/db/repositories/vocabulary");
    const entry = (await getVocabularyEntry(SEED_VOCABULARY[0].id))!;
    await putVocabularyEntry({ ...entry, saved: true });

    await setMeta(SEED_META_KEY, { version: SEED_VERSION - 1, appliedAt: NOW });
    await seedDatabase({ now: NOW + 86_400_000 });

    expect((await getVocabularyEntry(SEED_VOCABULARY[0].id))?.saved).toBe(true);
  });

  it("writes no duplicate progress rows for the sentences that were already there", async () => {
    await seedDatabase({ now: NOW });
    const before = await countProgress();

    await setMeta(SEED_META_KEY, { version: SEED_VERSION - 1, appliedAt: NOW });
    const result = await seedDatabase({ now: NOW + 86_400_000 });

    expect(result.progressCreated).toBe(0);
    expect(await countProgress()).toBe(before);
  });

  it("never reuses a sentence id for different English", () => {
    // Reusing an id replaces the row in place, so the learner would keep one
    // sentence's schedule against another sentence's text.
    const byId = new Map<string, string>();
    for (const s of SEED_SENTENCES) {
      expect(byId.has(s.id), `${s.id} appears twice`).toBe(false);
      byId.set(s.id, s.en);
    }
    // The ids carried over from the previous deck still mean what they meant.
    expect(byId.get("seed-sentence-0001")).toBe("Where are you going?");
    expect(byId.get("seed-sentence-0006")).toBe("I don't have any blockers today.");
  });
});
