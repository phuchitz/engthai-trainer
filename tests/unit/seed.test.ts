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
