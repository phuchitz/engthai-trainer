import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { deleteDatabase } from "@/lib/db/client";
import { seedDatabase } from "@/lib/db/seed";
import { getSentence } from "@/lib/db/repositories/sentences";
import { getProgress } from "@/lib/db/repositories/progress";
import { listAttemptsForProgress, countAttempts } from "@/lib/db/repositories/attempts";
import { loadSettings } from "@/lib/db/repositories/settings";
import { submitAnswer, skipCard, DICTATION_DIRECTION } from "@/lib/study";
import { addLocalDays, startOfLocalDay } from "@/lib/srs";
import { progressId } from "@/lib/utils/id";
import type { Sentence } from "@/lib/models";

const NOW = Date.parse("2026-09-20T15:00:00+07:00");
const SENTENCE_ID = "seed-sentence-0002";
const CARD = progressId("sentence", SENTENCE_ID, DICTATION_DIRECTION);
const CORRECT = "I am very hungry.";

let sentence: Sentence;

beforeEach(async () => {
  await deleteDatabase();
  await seedDatabase({ now: NOW });
  sentence = (await getSentence(SENTENCE_ID))!;
});

afterEach(async () => {
  await deleteDatabase();
});

const submit = (userAnswer: string, now = NOW, over: Partial<Parameters<typeof submitAnswer>[0]> = {}) =>
  submitAnswer({
    sessionId: "session-1",
    sentence,
    mode: "dictation",
    userAnswer,
    durationMs: 3000,
    hintUsed: false,
    ttsUsed: true,
    now,
    ...over,
  });

describe("submitAnswer — grading", () => {
  it("accepts a correct answer and awards XP", async () => {
    const outcome = await submit(CORRECT);
    expect(outcome.result.correct).toBe(true);
    expect(outcome.verdict).toBe("correct");
    expect(outcome.xpAwarded).toBeGreaterThan(0);
    expect(outcome.xpWasNew).toBe(true);
  });

  it("ignores case and punctuation, as the settings allow", async () => {
    expect((await submit("i am very hungry")).result.correct).toBe(true);
  });

  it("awards reduced XP for a near miss", async () => {
    const outcome = await submit("I am very hungy");
    expect(outcome.result.band).toBe("great");
    expect(outcome.xpAwarded).toBeGreaterThan(0);
    expect(outcome.xpAwarded).toBeLessThan(10);
  });

  it("awards nothing for a wrong answer", async () => {
    const outcome = await submit("the cat sat down");
    expect(outcome.xpAwarded).toBe(0);
    expect(outcome.verdict).toBe("incorrect");
  });

  it("halves XP when the hint was used", async () => {
    const outcome = await submit(CORRECT, NOW, { hintUsed: true });
    expect(outcome.xpAwarded).toBe(5);
  });
});

describe("submitAnswer — persistence", () => {
  it("appends an attempt", async () => {
    await submit(CORRECT);
    const attempts = await listAttemptsForProgress(CARD);
    expect(attempts).toHaveLength(1);
    expect(attempts[0].userAnswer).toBe(CORRECT);
    expect(attempts[0].mode).toBe("dictation");
  });

  it("advances the schedule", async () => {
    const before = await getProgress(CARD);
    expect(before?.practiceCount).toBe(0);

    const outcome = await submit(CORRECT);
    const after = await getProgress(CARD);

    expect(after?.practiceCount).toBe(1);
    expect(after?.correctCount).toBe(1);
    expect(after?.consecutiveSuccesses).toBe(1);
    expect(after?.intervalDays).toBe(1);
    expect(after?.nextReviewAt).toBe(addLocalDays(NOW, 1));
    expect(outcome.nextReviewAt).toBe(addLocalDays(NOW, 1));
  });

  it("leaves a failed card due again today", async () => {
    await submit("completely wrong words here");
    const after = await getProgress(CARD);
    expect(after?.nextReviewAt).toBe(startOfLocalDay(NOW));
    expect(after?.lapses).toBe(1);
  });

  it("counts the mistake against the exercise mode that produced it", async () => {
    await submit("completely wrong words here");
    const after = await getProgress(CARD);
    expect(after?.mistakesByMode.dictation).toBe(1);
    expect(after?.mistakesByMode.translate).toBe(0);
  });

  it("starts the streak", async () => {
    await submit(CORRECT);
    const settings = await loadSettings(NOW);
    expect(settings.streak.current).toBe(1);
    expect(settings.streak.lastStudyDate).toBe("2026-09-20");
  });
});

describe("duplicate XP prevention", () => {
  it("pays only once when the same answer is submitted twice", async () => {
    const first = await submit(CORRECT);
    const second = await submit(CORRECT);

    expect(first.xpAwarded).toBeGreaterThan(0);
    expect(second.xpAwarded).toBe(0);
    expect(second.xpWasNew).toBe(false);
  });

  it("pays only once across many resubmissions", async () => {
    const outcomes = [];
    for (let i = 0; i < 5; i++) outcomes.push(await submit(CORRECT));
    const total = outcomes.reduce((sum, o) => sum + o.xpAwarded, 0);
    expect(total).toBe(10);
  });

  it("survives a simulated reload, because the decision comes from the attempt log", async () => {
    await submit(CORRECT);
    // A reload drops every store, but not the database.
    const { closeDatabase } = await import("@/lib/db/client");
    await closeDatabase();
    expect((await submit(CORRECT)).xpAwarded).toBe(0);
  });

  it("pays again the next day", async () => {
    await submit(CORRECT);
    const tomorrow = addLocalDays(NOW, 1) + 9 * 3_600_000;
    expect((await submit(CORRECT, tomorrow)).xpAwarded).toBeGreaterThan(0);
  });

  it("pays on a pass that follows earlier failures", async () => {
    await submit("wrong answer entirely");
    await submit("still wrong entirely");
    expect((await submit(CORRECT)).xpAwarded).toBeGreaterThan(0);
  });
});

describe("retrying does not re-schedule", () => {
  it("keeps the interval from the first graded answer of the day", async () => {
    await submit("completely wrong words here");
    const afterFailure = await getProgress(CARD);
    expect(afterFailure?.intervalDays).toBe(0);

    const retry = await submit(CORRECT);
    const afterRetry = await getProgress(CARD);

    expect(retry.scheduled).toBe(false);
    expect(afterRetry?.intervalDays).toBe(0);
    expect(afterRetry?.practiceCount).toBe(1);
  });

  it("still records the retry as an attempt", async () => {
    await submit("completely wrong words here");
    await submit(CORRECT);
    expect(await listAttemptsForProgress(CARD)).toHaveLength(2);
  });
});

describe("skipping", () => {
  it("never counts as a success", async () => {
    await skipCard({ sessionId: "session-1", sentence, mode: "dictation", durationMs: 1000, now: NOW });

    const progress = await getProgress(CARD);
    expect(progress?.practiceCount).toBe(0);
    expect(progress?.correctCount).toBe(0);

    const settings = await loadSettings(NOW);
    expect(settings.streak.current).toBe(0);
  });

  it("does not move the schedule, so the card stays due", async () => {
    const before = await getProgress(CARD);
    await skipCard({ sessionId: "session-1", sentence, mode: "dictation", durationMs: 1000, now: NOW });
    expect((await getProgress(CARD))?.nextReviewAt).toBe(before?.nextReviewAt);
  });

  it("is still logged, so repeated avoidance is visible", async () => {
    await skipCard({ sessionId: "session-1", sentence, mode: "dictation", durationMs: 1000, now: NOW });
    const attempts = await listAttemptsForProgress(CARD);
    expect(attempts).toHaveLength(1);
    expect(attempts[0].verdict).toBe("skipped");
  });

  it("leaves a later answer fully eligible for XP and scheduling", async () => {
    await skipCard({ sessionId: "session-1", sentence, mode: "dictation", durationMs: 1000, now: NOW });
    const outcome = await submit(CORRECT);
    expect(outcome.xpAwarded).toBeGreaterThan(0);
    expect(outcome.scheduled).toBe(true);
  });
});

describe("daily goal", () => {
  it("counts distinct cards passed today", async () => {
    const first = await submit(CORRECT);
    expect(first.cardsCompletedToday).toBe(1);

    const other = (await getSentence("seed-sentence-0003"))!;
    const second = await submitAnswer({
      sessionId: "session-1",
      sentence: other,
      mode: "dictation",
      userAnswer: other.en,
      durationMs: 1000,
      hintUsed: false,
      ttsUsed: false,
      now: NOW,
    });
    expect(second.cardsCompletedToday).toBe(2);
  });

  it("does not double-count a repeated card", async () => {
    await submit(CORRECT);
    expect((await submit(CORRECT)).cardsCompletedToday).toBe(1);
  });
});

describe("attempt log stays append-only", () => {
  it("records every submission including skips", async () => {
    await submit("wrong words entirely");
    await submit(CORRECT);
    await skipCard({ sessionId: "session-1", sentence, mode: "dictation", durationMs: 500, now: NOW });
    expect(await countAttempts()).toBe(3);
  });
});

describe("Multiple Choice is practice only", () => {
  const pick = (userAnswer: string, now = NOW) =>
    submit(userAnswer, now, {
      mode: "multipleChoice",
      // What the store passes: the whole sentence, graded all or nothing.
      scoring: { expected: sentence.en, alternatives: sentence.enAlternates, exactOnly: true },
    });

  it("pays XP for the right pick, like any other pass", async () => {
    const outcome = await pick(CORRECT);

    expect(outcome.verdict).toBe("correct");
    expect(outcome.result.accuracy).toBe(100);
    expect(outcome.xpAwarded).toBe(10);
  });

  it("never moves the schedule, even on the first answer of the day", async () => {
    // The whole point: recognising a sentence among four must not buy an interval on a
    // card scheduled for producing it.
    const outcome = await pick(CORRECT);

    expect(outcome.scheduled).toBe(false);
    expect(outcome.nextReviewAt).toBeNull();

    // The row exists from seeding; what matters is that none of it moved.
    const progress = await getProgress(CARD);
    expect(progress?.practiceCount).toBe(0);
    expect(progress?.intervalDays).toBe(0);
    expect(progress?.nextReviewAt).toBe(NOW);
  });

  it("leaves an existing schedule exactly where it was", async () => {
    await submit(CORRECT);
    const before = await getProgress(CARD);

    await pick(CORRECT, NOW + 1000);

    const after = await getProgress(CARD);
    expect(after?.nextReviewAt).toBe(before?.nextReviewAt);
    expect(after?.intervalDays).toBe(before?.intervalDays);
    expect(after?.practiceCount).toBe(before?.practiceCount);
  });

  it("does not let a typed answer's schedule move be claimed by a pick", async () => {
    const outcome = await pick(CORRECT);
    expect(outcome.scheduled).toBe(false);

    // The same card, answered properly afterwards, still schedules normally.
    const typed = await submit(CORRECT, NOW + 1000);
    expect(typed.scheduled).toBe(true);
    expect(typed.nextReviewAt).not.toBeNull();
  });

  it("scores a near-miss pick at zero rather than flattering it", async () => {
    // "I am hungry." shares three words of four, which word-level similarity would
    // call a pass. There is no partial credit in a multiple-choice question.
    const outcome = await pick("I am hungry.");

    expect(outcome.result.accuracy).toBe(0);
    expect(outcome.result.band).toBe("tryAgain");
    expect(outcome.verdict).toBe("incorrect");
    expect(outcome.xpAwarded).toBe(0);
  });

  it("still shows which words differed", async () => {
    // The diff is the most useful thing on the screen after a wrong pick, so zeroing
    // the score must not zero the feedback.
    const outcome = await pick("I am hungry.");
    expect(outcome.result.missing).toContain("very");
  });

  it("accepts an authored alternative as correct", async () => {
    const outcome = await pick("I'm very hungry.");
    expect(outcome.result.correct).toBe(true);
    expect(outcome.result.accuracy).toBe(100);
  });

  it("records the mistake against the mode even though nothing was scheduled", async () => {
    // Which mode an item is failed in is a teaching signal, not a scheduling one.
    await pick("I am hungry.");

    const progress = await getProgress(CARD);
    expect(progress?.mistakesByMode.multipleChoice).toBe(1);
    // ...and no scheduling state came with it.
    expect(progress?.practiceCount).toBe(0);
    expect(progress?.intervalDays).toBe(0);
  });

  it("logs the attempt so the dashboard still counts it", async () => {
    await pick(CORRECT);

    const attempts = await listAttemptsForProgress(CARD);
    expect(attempts).toHaveLength(1);
    expect(attempts[0].mode).toBe("multipleChoice");
    expect(attempts[0].xpAwarded).toBe(10);
    expect(await countAttempts()).toBe(1);
  });

  it("pays XP once a day, the same as every other mode", async () => {
    expect((await pick(CORRECT)).xpAwarded).toBe(10);
    expect((await pick(CORRECT, NOW + 1000)).xpAwarded).toBe(0);
  });
});
