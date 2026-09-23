import { describe, it, expect } from "vitest";
import {
  createMultipleChoicePuzzle,
  chosenText,
  isCorrectChoice,
  MIN_OPTIONS,
  OPTION_COUNT,
  MODE_INFO,
  modeSchedules,
} from "@/lib/exercises";

const ANSWER = "Where are you going?";

const POOL = [
  "Where are you from?",
  "Where have you been?",
  "Where are you staying?",
  "I am very hungry.",
  "I will call you tomorrow.",
  "Could you take another look at my pull request before the release goes out?",
];

const build = (answer = ANSWER, pool: readonly string[] = POOL, seed?: number) =>
  createMultipleChoicePuzzle(answer, pool, seed);

describe("building a question", () => {
  it("offers the answer plus distractors, up to the option count", () => {
    const puzzle = build()!;
    expect(puzzle.options).toHaveLength(OPTION_COUNT);
    expect(puzzle.options.filter((o) => o.correct)).toHaveLength(1);
  });

  it("includes the correct answer exactly once", () => {
    const puzzle = build()!;
    expect(puzzle.options.filter((o) => o.text === ANSWER)).toHaveLength(1);
    expect(puzzle.options[puzzle.answerIndex].text).toBe(ANSWER);
  });

  it("draws every wrong answer from the pool, never inventing one", () => {
    // The same rule the word panel follows: this app does not generate language.
    const puzzle = build()!;
    for (const option of puzzle.options) {
      if (option.correct) continue;
      expect(POOL, option.text).toContain(option.text);
    }
  });

  it("identifies options by position, not by text", () => {
    const puzzle = build()!;
    expect(puzzle.options.map((o) => o.id)).toEqual(puzzle.options.map((_, i) => String(i)));
  });

  it("is deterministic, so a reload shows the same question", () => {
    const first = build()!;
    const second = build()!;
    expect(second.options.map((o) => o.text)).toEqual(first.options.map((o) => o.text));
    expect(second.answerIndex).toBe(first.answerIndex);
  });

  it("does not always put the answer in the same place", () => {
    // A question whose answer is always first is not a question.
    const positions = new Set(
      ["Hello.", "Goodbye.", "See you later.", "Good morning.", "Good night."].map(
        (answer) => build(answer, POOL)?.answerIndex,
      ),
    );
    expect(positions.size).toBeGreaterThan(1);
  });
});

describe("distractors are plausible", () => {
  it("prefers alternatives close in length to the answer", () => {
    // A correct sentence that is visibly longer than every alternative can be picked
    // without reading the Thai at all.
    const puzzle = build()!;
    const words = (t: string) => t.split(/\s+/).length;
    const longest = Math.max(...puzzle.options.map((o) => words(o.text)));
    expect(longest - words(ANSWER)).toBeLessThanOrEqual(2);
    expect(puzzle.options.map((o) => o.text)).not.toContain(
      "Could you take another look at my pull request before the release goes out?",
    );
  });

  it("never offers the answer twice under a different spelling", () => {
    const puzzle = build(ANSWER, ["where are you going", "Where are you from?", "Hello.", "Goodbye."])!;
    expect(puzzle.options.map((o) => o.text)).not.toContain("where are you going");
  });

  it("drops duplicates within the pool", () => {
    const puzzle = build(ANSWER, ["Hello.", "hello", "HELLO!", "Goodbye.", "Good night."])!;
    const normalized = puzzle.options.map((o) => o.text.toLowerCase().replace(/[.!?]/g, ""));
    expect(new Set(normalized).size).toBe(normalized.length);
  });
});

describe("a pool too small to ask a question", () => {
  it("produces no puzzle rather than a question with one answer", () => {
    expect(build(ANSWER, [])).toBeNull();
    expect(build(ANSWER, ["Hello."])).toBeNull();
  });

  it("needs at least the minimum number of options", () => {
    // The answer counts as one, so MIN_OPTIONS needs MIN_OPTIONS - 1 distractors.
    const tooFew = Array.from({ length: MIN_OPTIONS - 2 }, (_, i) => `Filler ${i}.`);
    expect(build(ANSWER, tooFew)).toBeNull();
    expect(build(ANSWER, [...tooFew, "One more."])?.options).toHaveLength(MIN_OPTIONS);
  });

  it("treats a pool of nothing but the answer as empty", () => {
    expect(build(ANSWER, [ANSWER, "where are you going", "Where are you going"])).toBeNull();
  });

  it("refuses an empty answer", () => {
    expect(build("", POOL)).toBeNull();
    expect(build("   ", POOL)).toBeNull();
  });

  it("offers fewer than four options rather than nothing when the pool is thin", () => {
    const puzzle = build(ANSWER, ["Hello.", "Goodbye."])!;
    expect(puzzle.options).toHaveLength(3);
  });
});

describe("reading a selection", () => {
  const puzzle = build()!;

  it("returns the text at the chosen position", () => {
    expect(chosenText(puzzle, puzzle.answerIndex)).toBe(ANSWER);
  });

  it("returns an empty answer when nothing is chosen", () => {
    expect(chosenText(puzzle, null)).toBe("");
    expect(isCorrectChoice(puzzle, null)).toBe(false);
  });

  it("is safe on a position that does not exist", () => {
    expect(chosenText(puzzle, 99)).toBe("");
    expect(isCorrectChoice(puzzle, 99)).toBe(false);
  });

  it("knows which position is right", () => {
    for (let i = 0; i < puzzle.options.length; i++) {
      expect(isCorrectChoice(puzzle, i)).toBe(i === puzzle.answerIndex);
    }
  });
});

describe("how the mode is declared", () => {
  it("asks for English from a Thai prompt, on the English-production card", () => {
    const info = MODE_INFO.multipleChoice;
    expect(info.direction).toBe("th2en");
    expect(info.promptLanguage).toBe("th");
    expect(info.answerLanguage).toBe("en");
  });

  it("is the only mode that never moves the schedule", () => {
    // Recognising a sentence among four is a different, easier act than producing it.
    expect(modeSchedules("multipleChoice")).toBe(false);
    for (const mode of ["dictation", "translate", "fillBlank", "wordOrder", "speak"] as const) {
      expect(modeSchedules(mode), mode).toBe(true);
    }
  });
});
