import { describe, it, expect } from "vitest";
import { checkAnswer } from "@/lib/answer";
import {
  blankCountFor,
  createFillBlankPuzzle,
  fillIn,
  MAX_BLANKS,
  maskedTokens,
  scoreBlanks,
  type FillBlankPuzzle,
} from "@/lib/exercises";

const SENTENCE = "I will call you tomorrow";

/** Scores a set of answers the way the app does: through the answer checker. */
function accuracyFor(puzzle: FillBlankPuzzle, answers: string[]) {
  const { expected, received } = scoreBlanks(puzzle, answers);
  return checkAnswer(received, expected, { language: puzzle.language }).accuracy;
}

describe("blankCountFor", () => {
  it("always leaves at least one blank", () => {
    expect(blankCountFor(2)).toBe(1);
    expect(blankCountFor(4)).toBe(1);
  });

  it("scales roughly with sentence length", () => {
    expect(blankCountFor(8)).toBe(2);
    expect(blankCountFor(12)).toBe(3);
  });

  it("never exceeds the cap", () => {
    expect(blankCountFor(100)).toBe(MAX_BLANKS);
  });

  it("handles degenerate lengths", () => {
    expect(blankCountFor(0)).toBe(0);
    expect(blankCountFor(1)).toBe(1);
  });
});

describe("createFillBlankPuzzle", () => {
  it("keeps every token of the sentence", () => {
    expect(createFillBlankPuzzle(SENTENCE, "en").tokens).toEqual(["i", "will", "call", "you", "tomorrow"]);
  });

  it("removes content words rather than grammar words", () => {
    const puzzle = createFillBlankPuzzle(SENTENCE, "en");
    for (const blank of puzzle.blanks) {
      expect(["i", "you", "the", "a"]).not.toContain(blank.answer);
    }
  });

  it("records the blank's position and its answer", () => {
    const puzzle = createFillBlankPuzzle(SENTENCE, "en");
    for (const blank of puzzle.blanks) {
      expect(puzzle.tokens[blank.index]).toBe(blank.answer);
    }
  });

  it("keeps blanks in reading order", () => {
    const puzzle = createFillBlankPuzzle("the quick brown fox jumps over a lazy dog today", "en");
    const indexes = puzzle.blanks.map((b) => b.index);
    expect([...indexes].sort((a, b) => a - b)).toEqual(indexes);
  });

  it("is deterministic for the same sentence", () => {
    const a = createFillBlankPuzzle(SENTENCE, "en");
    const b = createFillBlankPuzzle(SENTENCE, "en");
    expect(a.blanks).toEqual(b.blanks);
  });

  it("falls back to any word when the sentence is all grammar words", () => {
    const puzzle = createFillBlankPuzzle("it is in the a", "en");
    expect(puzzle.blanks.length).toBeGreaterThan(0);
  });

  it("produces no blanks for empty text", () => {
    expect(createFillBlankPuzzle("", "en").blanks).toEqual([]);
  });

  it("never blanks the same position twice", () => {
    const puzzle = createFillBlankPuzzle("alpha beta gamma delta epsilon zeta eta theta", "en");
    expect(new Set(puzzle.blanks.map((b) => b.index)).size).toBe(puzzle.blanks.length);
  });
});

describe("maskedTokens", () => {
  it("hides exactly the blanked positions", () => {
    const puzzle = createFillBlankPuzzle(SENTENCE, "en");
    const masked = maskedTokens(puzzle);
    for (const [index, token] of masked.entries()) {
      const isBlank = puzzle.blanks.some((b) => b.index === index);
      expect(token === "____").toBe(isBlank);
    }
  });
});

describe("scoreBlanks — only the missing words count", () => {
  const puzzle: FillBlankPuzzle = {
    language: "en",
    tokens: ["i", "will", "call", "you", "tomorrow"],
    blanks: [
      { index: 2, answer: "call" },
      { index: 4, answer: "tomorrow" },
    ],
  };

  it("compares only the removed words", () => {
    expect(scoreBlanks(puzzle, ["call", "tomorrow"])).toEqual({
      expected: "call tomorrow",
      received: "call tomorrow",
    });
  });

  it("scores both blanks right as 100", () => {
    expect(accuracyFor(puzzle, ["call", "tomorrow"])).toBe(100);
  });

  it("is far harsher than grading the reassembled sentence", () => {
    // The whole point of scoring only the blanks. Graded as a sentence, the three words
    // that were never removed are always right and flatter the score.
    const blankOnly = accuracyFor(puzzle, ["call", "yesterday"]);
    const wholeSentence = checkAnswer("i will call you yesterday", "i will call you tomorrow", {
      language: "en",
    }).accuracy;

    expect(wholeSentence).toBeGreaterThanOrEqual(80);
    expect(blankOnly).toBeLessThan(70);
  });

  it("scores exactly half when one blank is right and the other is unrelated", () => {
    // An empty answer shares nothing with the expected word, so the halves are clean.
    expect(accuracyFor(puzzle, ["call", ""])).toBe(50);
  });

  it("keeps both blanks wrong below the pass threshold", () => {
    // Near-miss spelling earns partial credit inside a blank exactly as it does in a
    // full sentence, so this is not zero — but it is nowhere near a pass.
    const accuracy = accuracyFor(puzzle, ["walk", "yesterday"]);
    expect(accuracy).toBeLessThan(70);
  });

  it("gives partial credit for a typo in one blank", () => {
    const accuracy = accuracyFor(puzzle, ["call", "tomorow"]);
    expect(accuracy).toBeGreaterThan(50);
    expect(accuracy).toBeLessThan(100);
  });

  it("treats an unanswered blank as empty rather than shifting the others along", () => {
    const { expected, received } = scoreBlanks(puzzle, ["", "tomorrow"]);
    expect(expected).toBe("call tomorrow");
    expect(received).toBe(" tomorrow");
    expect(accuracyFor(puzzle, ["", "tomorrow"])).toBe(50);
  });

  it("keeps the second answer aligned when the first is missing entirely", () => {
    expect(scoreBlanks(puzzle, [undefined as unknown as string, "tomorrow"]).received).toBe(" tomorrow");
  });

  it("scores nothing answered as 0", () => {
    expect(accuracyFor(puzzle, ["", ""])).toBe(0);
  });

  it("trims stray whitespace around an answer", () => {
    expect(accuracyFor(puzzle, ["  call  ", "tomorrow"])).toBe(100);
  });

  it("ignores case, like every other typed English answer", () => {
    expect(accuracyFor(puzzle, ["Call", "TOMORROW"])).toBe(100);
  });

  it("scales with the number of blanks", () => {
    const three: FillBlankPuzzle = {
      language: "en",
      tokens: ["a", "b", "c"],
      blanks: [
        { index: 0, answer: "a" },
        { index: 1, answer: "b" },
        { index: 2, answer: "c" },
      ],
    };
    expect(accuracyFor(three, ["a", "b", "x"])).toBe(67);
    expect(accuracyFor(three, ["a", "x", "y"])).toBe(33);
  });

  it("scores a single blank as all or nothing", () => {
    const one: FillBlankPuzzle = {
      language: "en",
      tokens: ["i", "am", "hungry"],
      blanks: [{ index: 2, answer: "hungry" }],
    };
    expect(accuracyFor(one, ["hungry"])).toBe(100);
    expect(accuracyFor(one, [""])).toBe(0);
    // A different word earns only its letter overlap, well short of a pass.
    expect(accuracyFor(one, ["thirsty"])).toBeLessThan(70);
  });
});

describe("fillIn", () => {
  const puzzle = createFillBlankPuzzle(SENTENCE, "en");

  it("writes the learner's answers back into the sentence", () => {
    const answers = puzzle.blanks.map((b) => b.answer);
    expect(fillIn(puzzle, answers)).toBe("i will call you tomorrow");
  });

  it("shows a marker where nothing was entered", () => {
    expect(fillIn(puzzle, [])).toContain("____");
  });

  it("joins Thai without spaces", () => {
    const thai = createFillBlankPuzzle("ฉันหิวมาก", "th");
    expect(
      fillIn(
        thai,
        thai.blanks.map((b) => b.answer),
      ),
    ).toBe("ฉันหิวมาก");
  });
});
