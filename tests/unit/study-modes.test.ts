import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { deleteDatabase } from "@/lib/db/client";
import { seedDatabase } from "@/lib/db/seed";
import { getSentence } from "@/lib/db/repositories/sentences";
import { getProgress } from "@/lib/db/repositories/progress";
import { listAttemptsForProgress } from "@/lib/db/repositories/attempts";
import { submitAnswer } from "@/lib/study";
import {
  createFillBlankPuzzle,
  joinTokens,
  MODE_INFO,
  scoreBlanks,
  createWordOrderPuzzle,
} from "@/lib/exercises";
import { progressId } from "@/lib/utils/id";
import type { Sentence } from "@/lib/models";

const NOW = Date.parse("2026-09-20T15:00:00+07:00");
const SENTENCE_ID = "seed-sentence-0003"; // "I will call you tomorrow."

let sentence: Sentence;

beforeEach(async () => {
  await deleteDatabase();
  await seedDatabase({ now: NOW });
  sentence = (await getSentence(SENTENCE_ID))!;
});

afterEach(async () => {
  await deleteDatabase();
});

describe("mode directions", () => {
  it("routes the four English-producing modes to the same card", () => {
    for (const mode of ["dictation", "translate", "fillBlank", "speak"] as const) {
      expect(MODE_INFO[mode].direction).toBe("th2en");
    }
  });

  it("routes Sentence Builder to the Thai-producing card", () => {
    expect(MODE_INFO.wordOrder.direction).toBe("en2th");
    expect(MODE_INFO.wordOrder.answerLanguage).toBe("th");
  });

  it("schedules Sentence Builder independently of the English modes", async () => {
    await submitAnswer({
      sessionId: "s",
      sentence,
      mode: "translate",
      direction: "th2en",
      userAnswer: sentence.en,
      durationMs: 1000,
      hintUsed: false,
      ttsUsed: false,
      now: NOW,
    });

    const english = await getProgress(progressId("sentence", SENTENCE_ID, "th2en"));
    const thai = await getProgress(progressId("sentence", SENTENCE_ID, "en2th"));

    expect(english?.practiceCount).toBe(1);
    expect(thai?.practiceCount).toBe(0);
  });
});

describe("Sentence Builder grading", () => {
  it("accepts tiles assembled in the right order", async () => {
    const puzzle = createWordOrderPuzzle(sentence.th, "th");
    const outcome = await submitAnswer({
      sessionId: "s",
      sentence,
      mode: "wordOrder",
      direction: "en2th",
      userAnswer: joinTokens(puzzle.solution, "th"),
      durationMs: 1000,
      hintUsed: false,
      ttsUsed: false,
      now: NOW,
    });

    expect(outcome.result.correct).toBe(true);
    expect(outcome.xpAwarded).toBeGreaterThan(0);
  });

  it("rejects a wrong order, with no partial credit for Thai", async () => {
    const puzzle = createWordOrderPuzzle(sentence.th, "th");
    const outcome = await submitAnswer({
      sessionId: "s",
      sentence,
      mode: "wordOrder",
      direction: "en2th",
      userAnswer: joinTokens([...puzzle.solution].reverse(), "th"),
      durationMs: 1000,
      hintUsed: false,
      ttsUsed: false,
      now: NOW,
    });

    expect(outcome.result.correct).toBe(false);
    expect(outcome.result.band).toBe("tryAgain");
    expect(outcome.xpAwarded).toBe(0);
  });
});

describe("Fill in the Blank grading", () => {
  const puzzleFor = (s: Sentence) => createFillBlankPuzzle(s.en, "en");

  const submitBlanks = async (answers: string[]) => {
    const puzzle = puzzleFor(sentence);
    const { expected, received } = scoreBlanks(puzzle, answers);
    return submitAnswer({
      sessionId: "s",
      sentence,
      mode: "fillBlank",
      direction: "th2en",
      userAnswer: received,
      scoring: { expected, language: "en" },
      recordedAnswer: sentence.en,
      durationMs: 1000,
      hintUsed: false,
      ttsUsed: false,
      now: NOW,
    });
  };

  it("passes when every blank is right", async () => {
    const puzzle = puzzleFor(sentence);
    const outcome = await submitBlanks(puzzle.blanks.map((b) => b.answer));
    expect(outcome.result.correct).toBe(true);
    expect(outcome.result.accuracy).toBe(100);
  });

  it("scores only the blanks, not the untouched words", async () => {
    const puzzle = puzzleFor(sentence);
    const outcome = await submitBlanks(puzzle.blanks.map(() => ""));

    expect(outcome.result.accuracy).toBe(0);
    // Grading the whole sentence would have scored most of it correct.
    expect(outcome.result.expectedTokens.length).toBe(puzzle.blanks.length);
  });

  it("still records the full sentence in the attempt log", async () => {
    const puzzle = puzzleFor(sentence);
    await submitBlanks(puzzle.blanks.map((b) => b.answer));

    const attempts = await listAttemptsForProgress(progressId("sentence", SENTENCE_ID, "th2en"));
    expect(attempts[0].userAnswer).toBe(sentence.en);
    expect(attempts[0].expectedAnswer).toBe(sentence.en);
    expect(attempts[0].mode).toBe("fillBlank");
  });
});

describe("self-assessed speaking", () => {
  it("passes when the learner says the transcript was misheard", async () => {
    const outcome = await submitAnswer({
      sessionId: "s",
      sentence,
      mode: "speak",
      direction: "th2en",
      userAnswer: sentence.en,
      scoring: { expected: sentence.en, language: "en" },
      durationMs: 1000,
      hintUsed: false,
      ttsUsed: true,
      now: NOW,
    });

    expect(outcome.result.correct).toBe(true);
    expect(outcome.xpAwarded).toBeGreaterThan(0);
  });

  it("records a struggled attempt as a lapse without XP", async () => {
    const outcome = await submitAnswer({
      sessionId: "s",
      sentence,
      mode: "speak",
      direction: "th2en",
      userAnswer: "",
      durationMs: 1000,
      hintUsed: false,
      ttsUsed: true,
      now: NOW,
    });

    expect(outcome.xpAwarded).toBe(0);
    expect(outcome.verdict).toBe("incorrect");
    expect((await getProgress(progressId("sentence", SENTENCE_ID, "th2en")))?.lapses).toBe(1);
  });

  it("counts a speaking mistake against the speaking mode", async () => {
    await submitAnswer({
      sessionId: "s",
      sentence,
      mode: "speak",
      direction: "th2en",
      userAnswer: "something else entirely wrong",
      durationMs: 1000,
      hintUsed: false,
      ttsUsed: true,
      now: NOW,
    });

    const progress = await getProgress(progressId("sentence", SENTENCE_ID, "th2en"));
    expect(progress?.mistakesByMode.speak).toBe(1);
    expect(progress?.mistakesByMode.dictation).toBe(0);
  });
});
