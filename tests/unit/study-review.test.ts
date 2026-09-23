import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { deleteDatabase } from "@/lib/db/client";
import { putSentence } from "@/lib/db/repositories/sentences";
import { newProgress, putProgress } from "@/lib/db/repositories/progress";
import { buildReviewQueue, loadReviewCounts, modeForDirection } from "@/lib/study/review";
import { loadCategorySummaries } from "@/lib/study/stats";
import { buildStudyQueue } from "@/lib/study/queue";
import type { Category, Direction, Level, Sentence } from "@/lib/models";

const NOW = 1_700_000_000_000;
const DAY = 86_400_000;
const SETTINGS = { maxReviewsPerDay: 120, newPerDay: 10 };

async function sentence(id: string, over: Partial<Sentence> = {}): Promise<Sentence> {
  const row: Sentence = {
    id,
    en: `Sentence ${id}.`,
    th: `ประโยค ${id}`,
    enAlternates: [],
    thAlternates: [],
    tags: [],
    category: "daily",
    level: "A1",
    lessonIds: [],
    vocabIds: [],
    source: "builtin",
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  };
  await putSentence(row);
  return row;
}

/** A progress row with the scheduling fields a queue actually looks at. */
async function progress(
  itemId: string,
  direction: Direction,
  over: Partial<ReturnType<typeof newProgress>> = {},
) {
  return putProgress({ ...newProgress("sentence", itemId, direction, NOW), ...over });
}

beforeEach(async () => {
  await deleteDatabase();
});

afterEach(async () => {
  await deleteDatabase();
});

describe("modeForDirection", () => {
  it("asks an en2th card by building tiles and a th2en card by translating", () => {
    // The direction decides the skill; asking an en2th card as dictation would test
    // producing English from a card scheduled for producing Thai.
    expect(modeForDirection("en2th")).toBe("wordOrder");
    expect(modeForDirection("th2en")).toBe("translate");
  });
});

describe("the due queue", () => {
  it("is empty when nothing has ever been practised", async () => {
    await sentence("s1");
    await progress("s1", "th2en");

    expect(await loadReviewCounts(NOW)).toEqual({ due: 0, mistakes: 0 });
    expect(await buildReviewQueue("due", SETTINGS, NOW)).toHaveLength(0);
  });

  it("excludes a practised card whose day has not arrived", async () => {
    await sentence("s1");
    await progress("s1", "th2en", { practiceCount: 2, nextReviewAt: NOW + 3 * DAY });

    expect((await loadReviewCounts(NOW)).due).toBe(0);
  });

  it("includes a practised card once its scheduled day arrives", async () => {
    await sentence("s1");
    await progress("s1", "th2en", { practiceCount: 2, nextReviewAt: NOW - DAY });

    expect((await loadReviewCounts(NOW)).due).toBe(1);
    expect(await buildReviewQueue("due", SETTINGS, NOW)).toHaveLength(1);
  });

  it("drains the oldest backlog first", async () => {
    await sentence("old");
    await sentence("recent");
    await progress("old", "th2en", { practiceCount: 1, nextReviewAt: NOW - 10 * DAY });
    await progress("recent", "th2en", { practiceCount: 1, nextReviewAt: NOW - DAY });

    const queue = await buildReviewQueue("due", SETTINGS, NOW);
    expect(queue.map((c) => c.sentence.id)).toEqual(["old", "recent"]);
  });

  it("never serves a new card, whatever the limits say", async () => {
    // Review is for cards the scheduler promised; new cards belong to a lesson.
    await sentence("fresh");
    await progress("fresh", "th2en", { nextReviewAt: NOW - DAY });

    expect(await buildReviewQueue("due", SETTINGS, NOW)).toHaveLength(0);
  });

  it("caps the queue but reports the whole backlog", async () => {
    for (let i = 0; i < 5; i++) {
      await sentence(`s${i}`);
      await progress(`s${i}`, "th2en", { practiceCount: 1, nextReviewAt: NOW - (i + 1) * DAY });
    }

    expect((await loadReviewCounts(NOW)).due).toBe(5);
    expect(await buildReviewQueue("due", { maxReviewsPerDay: 2 }, NOW)).toHaveLength(2);
  });

  it("carries each card's own mode, so a queue mixes them", async () => {
    await sentence("s1");
    await progress("s1", "th2en", { practiceCount: 1, nextReviewAt: NOW - 2 * DAY });
    await progress("s1", "en2th", { practiceCount: 1, nextReviewAt: NOW - DAY });

    const queue = await buildReviewQueue("due", SETTINGS, NOW);
    expect(queue.map((c) => c.mode)).toEqual(["translate", "wordOrder"]);
  });

  it("ignores a suspended card", async () => {
    await sentence("s1");
    await progress("s1", "th2en", { practiceCount: 3, nextReviewAt: NOW - DAY, suspended: true });

    expect((await loadReviewCounts(NOW)).due).toBe(0);
  });

  it("ignores progress rows whose sentence has been deleted", async () => {
    await progress("ghost", "th2en", { practiceCount: 1, nextReviewAt: NOW - DAY });
    expect(await loadReviewCounts(NOW)).toEqual({ due: 0, mistakes: 0 });
  });
});

describe("the mistake queue", () => {
  it("includes a failed card that is not due, because that is the point", async () => {
    await sentence("s1");
    await progress("s1", "th2en", {
      practiceCount: 3,
      incorrectCount: 2,
      nextReviewAt: NOW + 30 * DAY,
    });

    expect((await loadReviewCounts(NOW)).mistakes).toBe(1);
    expect(await buildReviewQueue("mistakes", SETTINGS, NOW)).toHaveLength(1);
  });

  it("leaves out a card that has never been got wrong", async () => {
    await sentence("s1");
    await progress("s1", "th2en", { practiceCount: 9, correctCount: 9, nextReviewAt: NOW - DAY });

    expect((await loadReviewCounts(NOW)).mistakes).toBe(0);
  });

  it("ranks by a smoothed failure rate, not by raw count", async () => {
    // One failure out of one is 1/2 smoothed; five out of nine is 5/10 — so the
    // long-running struggle outranks the single unlucky answer.
    await sentence("once");
    await sentence("often");
    await progress("once", "th2en", { practiceCount: 1, incorrectCount: 1 });
    await progress("often", "th2en", { practiceCount: 9, incorrectCount: 5 });

    const queue = await buildReviewQueue("mistakes", SETTINGS, NOW);
    expect(queue.map((c) => c.sentence.id)).toEqual(["often", "once"]);
  });

  it("overlaps the due queue rather than stealing from it", async () => {
    await sentence("s1");
    await progress("s1", "th2en", { practiceCount: 4, incorrectCount: 2, nextReviewAt: NOW - DAY });

    const counts = await loadReviewCounts(NOW);
    expect(counts).toEqual({ due: 1, mistakes: 1 });
  });
});

describe("category summaries for the Lessons screen", () => {
  it("returns every category, including the empty ones", async () => {
    const summaries = await loadCategorySummaries(NOW);
    expect(summaries).toHaveLength(7);
    expect(summaries.every((s) => s.total === 0)).toBe(true);
    // An empty category shows 0%, never a division by zero.
    expect(summaries.every((s) => s.completionPercent === 0)).toBe(true);
  });

  it("counts a sentence as complete once it is right in any direction", async () => {
    await sentence("s1");
    await sentence("s2");
    await progress("s1", "en2th", { practiceCount: 1, correctCount: 1 });
    await progress("s2", "th2en", { practiceCount: 1, correctCount: 0, incorrectCount: 1 });

    const daily = (await loadCategorySummaries(NOW)).find((s) => s.category === "daily")!;
    expect(daily.total).toBe(2);
    expect(daily.completed).toBe(1);
    expect(daily.completionPercent).toBe(50);
  });

  it("counts a sentence once even when both directions are complete", async () => {
    await sentence("s1");
    await progress("s1", "en2th", { practiceCount: 1, correctCount: 1 });
    await progress("s1", "th2en", { practiceCount: 1, correctCount: 1 });

    const daily = (await loadCategorySummaries(NOW)).find((s) => s.category === "daily")!;
    expect(daily.completed).toBe(1);
    expect(daily.completionPercent).toBe(100);
  });

  it("reports the level range actually present", async () => {
    await sentence("a", { level: "B1" as Level });
    await sentence("b", { level: "A2" as Level });
    await sentence("c", { level: "A2" as Level });

    const daily = (await loadCategorySummaries(NOW)).find((s) => s.category === "daily")!;
    expect(daily.levels).toEqual(["A2", "B1"]);
  });

  it("keeps categories apart", async () => {
    await sentence("d1", { category: "daily" as Category });
    await sentence("w1", { category: "workplace" as Category });

    const summaries = await loadCategorySummaries(NOW);
    expect(summaries.find((s) => s.category === "daily")!.total).toBe(1);
    expect(summaries.find((s) => s.category === "workplace")!.total).toBe(1);
    expect(summaries.find((s) => s.category === "travel")!.total).toBe(0);
  });
});

describe("the lesson queue", () => {
  it("treats a sentence with no progress row as new rather than skipping it", async () => {
    // An imported sentence must be studiable immediately, with no backfill step.
    await sentence("imported");
    const queue = await buildStudyQueue("daily", SETTINGS, NOW);
    expect(queue.map((s) => s.id)).toEqual(["imported"]);
  });

  it("puts due reviews before new cards", async () => {
    await sentence("due");
    await sentence("fresh");
    await progress("due", "th2en", { practiceCount: 2, nextReviewAt: NOW - DAY });

    const queue = await buildStudyQueue("daily", SETTINGS, NOW);
    expect(queue.map((s) => s.id)).toEqual(["due", "fresh"]);
  });

  it("honours the daily allowance for new cards", async () => {
    for (let i = 0; i < 6; i++) await sentence(`s${i}`);
    const queue = await buildStudyQueue("daily", { ...SETTINGS, newPerDay: 3 }, NOW);
    expect(queue).toHaveLength(3);
  });

  it("returns nothing for a category with no sentences", async () => {
    await sentence("s1", { category: "daily" as Category });
    expect(await buildStudyQueue("travel", SETTINGS, NOW)).toHaveLength(0);
  });
});
