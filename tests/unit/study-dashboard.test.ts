import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { deleteDatabase } from "@/lib/db/client";
import { putSentence } from "@/lib/db/repositories/sentences";
import { putVocabularyEntry } from "@/lib/db/repositories/vocabulary";
import { newProgress, putProgress } from "@/lib/db/repositories/progress";
import { addAttempt } from "@/lib/db/repositories/attempts";
import { loadSettings, saveSettings } from "@/lib/db/repositories/settings";
import { loadDashboard } from "@/lib/study/dashboard";
import { attemptSchema, type Attempt, type Category, type Sentence, type Verdict } from "@/lib/models";
import { progressId } from "@/lib/utils/id";

const NOW = 1_700_000_000_000;
const DAY = 86_400_000;

async function sentence(id: string, category: Category = "daily"): Promise<Sentence> {
  const row: Sentence = {
    id,
    en: `Sentence ${id}.`,
    th: `ประโยค ${id}`,
    enAlternates: [],
    thAlternates: [],
    tags: [],
    category,
    level: "A1",
    lessonIds: [],
    vocabIds: [],
    source: "builtin",
    createdAt: NOW,
    updatedAt: NOW,
  };
  await putSentence(row);
  return row;
}

let attemptSeq = 0;

async function attempt(over: Partial<Attempt> = {}): Promise<Attempt> {
  attemptSeq += 1;
  const itemId = over.itemId ?? "s1";
  const direction = over.direction ?? "th2en";
  const row = attemptSchema.parse({
    id: `a${attemptSeq}`,
    sessionId: "sess",
    progressId: progressId("sentence", itemId, direction),
    itemType: "sentence",
    itemId,
    direction,
    mode: "translate",
    prompt: "ประโยค",
    userAnswer: "answer",
    expectedAnswer: "answer",
    verdict: "correct" as Verdict,
    grade: 3,
    similarity: 1,
    durationMs: 0,
    xpAwarded: 0,
    createdAt: NOW,
    ...over,
  });
  return addAttempt(row);
}

beforeEach(async () => {
  await deleteDatabase();
  attemptSeq = 0;
});

afterEach(async () => {
  await deleteDatabase();
});

describe("a dashboard with no history", () => {
  it("reports honest zeros rather than a misleading accuracy", async () => {
    const data = await loadDashboard(NOW);

    expect(data.hasHistory).toBe(false);
    expect(data.sentencesToday).toBe(0);
    expect(data.xpToday).toBe(0);
    expect(data.xpTotal).toBe(0);
    expect(data.activeMsTotal).toBe(0);
    // Zero graded answers is "no data", not "0% correct".
    expect(data.accuracyAllTime.graded).toBe(0);
    expect(data.accuracyToday.graded).toBe(0);
    expect(data.recent).toHaveLength(0);
    expect(data.unlocked).toHaveLength(0);
  });

  it("still knows the daily goal from settings", async () => {
    const settings = await loadSettings(NOW);
    await saveSettings({ ...settings, dailyGoal: 30 }, NOW);

    const data = await loadDashboard(NOW);
    expect(data.dailyGoal).toBe(30);
    expect(data.goalPercent).toBe(0);
  });
});

describe("XP and the daily goal", () => {
  it("sums the XP actually paid, rather than recomputing it", async () => {
    await sentence("s1");
    await attempt({ xpAwarded: 10 });
    await attempt({ xpAwarded: 6 });
    await attempt({ xpAwarded: 0 });

    const data = await loadDashboard(NOW);
    expect(data.xpTotal).toBe(16);
    expect(data.xpToday).toBe(16);
  });

  it("separates today's XP from the all-time total", async () => {
    await sentence("s1");
    await attempt({ xpAwarded: 10, createdAt: NOW - 3 * DAY });
    await attempt({ xpAwarded: 10, createdAt: NOW });

    const data = await loadDashboard(NOW);
    expect(data.xpTotal).toBe(20);
    expect(data.xpToday).toBe(10);
  });

  it("counts distinct sentences towards the goal, not cards", async () => {
    // One sentence has a card per direction; counting cards would tick it twice.
    await sentence("s1");
    await attempt({ itemId: "s1", direction: "th2en", verdict: "correct" });
    await attempt({ itemId: "s1", direction: "en2th", verdict: "correct" });

    const data = await loadDashboard(NOW);
    expect(data.sentencesToday).toBe(1);
  });

  it("caps the goal bar at a hundred percent", async () => {
    const settings = await loadSettings(NOW);
    await saveSettings({ ...settings, dailyGoal: 1 }, NOW);

    await sentence("s1");
    await sentence("s2");
    await attempt({ itemId: "s1", verdict: "correct" });
    await attempt({ itemId: "s2", verdict: "correct" });

    expect((await loadDashboard(NOW)).goalPercent).toBe(100);
  });
});

describe("accuracy", () => {
  it("counts every graded attempt, so retrying until right lowers it", async () => {
    await sentence("s1");
    await attempt({ verdict: "incorrect", grade: 1 });
    await attempt({ verdict: "correct" });

    const data = await loadDashboard(NOW);
    expect(data.accuracyAllTime.graded).toBe(2);
    expect(data.accuracyAllTime.percent).toBe(50);
  });

  it("excludes skips entirely rather than counting them as wrong", async () => {
    await sentence("s1");
    await attempt({ verdict: "correct" });
    await attempt({ verdict: "skipped", grade: 1 });

    const data = await loadDashboard(NOW);
    expect(data.accuracyAllTime.graded).toBe(1);
    expect(data.accuracyAllTime.percent).toBe(100);
  });

  it("keeps today's accuracy separate from all time", async () => {
    await sentence("s1");
    await attempt({ verdict: "incorrect", grade: 1, createdAt: NOW - 2 * DAY });
    await attempt({ verdict: "correct", createdAt: NOW });

    const data = await loadDashboard(NOW);
    expect(data.accuracyToday.percent).toBe(100);
    expect(data.accuracyAllTime.percent).toBe(50);
  });
});

describe("active study time", () => {
  it("sums the per-card durations the timer already trimmed", async () => {
    await sentence("s1");
    await attempt({ durationMs: 4_000 });
    await attempt({ durationMs: 11_000 });

    const data = await loadDashboard(NOW);
    expect(data.activeMsTotal).toBe(15_000);
    expect(data.activeMsToday).toBe(15_000);
  });

  it("does not count yesterday's time as today's", async () => {
    await sentence("s1");
    await attempt({ durationMs: 60_000, createdAt: NOW - DAY });
    await attempt({ durationMs: 5_000, createdAt: NOW });

    const data = await loadDashboard(NOW);
    expect(data.activeMsTotal).toBe(65_000);
    expect(data.activeMsToday).toBe(5_000);
  });
});

describe("recent categories", () => {
  it("lists the categories practised, most recent first", async () => {
    await sentence("d1", "daily");
    await sentence("w1", "workplace");
    await attempt({ itemId: "d1", createdAt: NOW - 2 * DAY });
    await attempt({ itemId: "w1", createdAt: NOW - DAY });

    const data = await loadDashboard(NOW);
    expect(data.recent.map((r) => r.category)).toEqual(["workplace", "daily"]);
    expect(data.recent[0].label).toBe("Workplace English");
  });

  it("counts the attempts per category", async () => {
    await sentence("d1", "daily");
    await attempt({ itemId: "d1" });
    await attempt({ itemId: "d1" });

    expect((await loadDashboard(NOW)).recent[0].attempts).toBe(2);
  });

  it("ignores an attempt whose sentence no longer exists", async () => {
    await attempt({ itemId: "deleted" });
    expect((await loadDashboard(NOW)).recent).toHaveLength(0);
  });
});

describe("badges and review counts come through", () => {
  it("unlocks a badge from the derived stats", async () => {
    await sentence("s1");
    await attempt({ verdict: "correct", xpAwarded: 10 });

    const data = await loadDashboard(NOW);
    expect(data.unlocked.map((a) => a.id)).toContain("first-sentence");
    expect(data.locked.map((a) => a.id)).toContain("ten-sentences");
  });

  it("counts saved words for the collector badge", async () => {
    await putVocabularyEntry({
      id: "v1",
      en: "blocker",
      th: "สิ่งที่ติดขัด",
      forms: [],
      contexts: [],
      saved: true,
      exampleSentenceIds: [],
      tags: [],
      level: "B1",
      source: "builtin",
      createdAt: NOW,
      updatedAt: NOW,
    });

    expect((await loadDashboard(NOW)).stats.savedWords).toBe(1);
  });

  it("surfaces the due and mistake backlogs", async () => {
    await sentence("s1");
    await putProgress({
      ...newProgress("sentence", "s1", "th2en", NOW),
      practiceCount: 4,
      incorrectCount: 2,
      nextReviewAt: NOW - DAY,
    });

    const data = await loadDashboard(NOW);
    expect(data.dueCount).toBe(1);
    expect(data.mistakeCount).toBe(1);
  });
});
