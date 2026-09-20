import { describe, it, expect } from "vitest";
import { checkAnswer } from "@/lib/answer";
import { buildTokens, createWordOrderPuzzle, isComplete, joinTokens, remainingTiles } from "@/lib/exercises";

describe("buildTokens", () => {
  it("splits an English sentence into one tile per word", () => {
    expect(buildTokens("I am very hungry.", "en").map((t) => t.text)).toEqual(["i", "am", "very", "hungry"]);
  });

  it("segments Thai, which is written without spaces", () => {
    expect(buildTokens("ฉันหิวมาก", "th").map((t) => t.text)).toEqual(["ฉัน", "หิว", "มาก"]);
  });

  it("records each token's position in the answer", () => {
    expect(buildTokens("one two three", "en").map((t) => t.index)).toEqual([0, 1, 2]);
  });

  it("returns no tiles for empty text", () => {
    expect(buildTokens("", "en")).toEqual([]);
  });
});

describe("repeated words", () => {
  const REPEATED = "very very good and very fast";

  it("gives each occurrence its own tile", () => {
    const tokens = buildTokens(REPEATED, "en");
    const verys = tokens.filter((t) => t.text === "very");
    expect(verys).toHaveLength(3);
    expect(new Set(verys.map((t) => t.id)).size).toBe(3);
  });

  it("consumes only the tapped occurrence, not every copy of the word", () => {
    const puzzle = createWordOrderPuzzle(REPEATED, "en");
    const firstVery = puzzle.tiles.find((t) => t.text === "very")!;

    const remaining = remainingTiles(puzzle, [firstVery]);

    expect(remaining).toHaveLength(puzzle.tiles.length - 1);
    expect(remaining.filter((t) => t.text === "very")).toHaveLength(2);
    expect(remaining.some((t) => t.id === firstVery.id)).toBe(false);
  });

  it("removes the right tile when an earlier duplicate is taken back", () => {
    const puzzle = createWordOrderPuzzle(REPEATED, "en");
    const verys = puzzle.tiles.filter((t) => t.text === "very");
    const placed = [verys[0], verys[1], verys[2]];

    // The learner un-taps the middle one.
    const afterUndo = placed.filter((t) => t.id !== verys[1].id);

    expect(afterUndo.map((t) => t.id)).toEqual([verys[0].id, verys[2].id]);
    expect(remainingTiles(puzzle, afterUndo).some((t) => t.id === verys[1].id)).toBe(true);
  });

  it("accepts the sentence when duplicates are placed in any order among themselves", () => {
    const puzzle = createWordOrderPuzzle(REPEATED, "en");
    const solution = puzzle.solution;
    const verys = solution.filter((t) => t.text === "very");

    // Swap two interchangeable "very" tiles: the text is identical, so it must still pass.
    const swapped = solution.map((token) => {
      if (token.id === verys[0].id) return verys[1];
      if (token.id === verys[1].id) return verys[0];
      return token;
    });

    const answer = joinTokens(swapped, "en");
    expect(checkAnswer(answer, REPEATED, { language: "en" }).correct).toBe(true);
  });

  it("handles a sentence made entirely of one repeated word", () => {
    const puzzle = createWordOrderPuzzle("no no no", "en");
    expect(puzzle.tiles).toHaveLength(3);
    expect(joinTokens(puzzle.solution, "en")).toBe("no no no");
  });
});

describe("createWordOrderPuzzle", () => {
  it("presents every token exactly once", () => {
    const puzzle = createWordOrderPuzzle("I will call you tomorrow", "en");
    expect([...puzzle.tiles].map((t) => t.id).sort()).toEqual([...puzzle.solution].map((t) => t.id).sort());
  });

  it("is deterministic for the same sentence", () => {
    const a = createWordOrderPuzzle("I will call you tomorrow", "en");
    const b = createWordOrderPuzzle("I will call you tomorrow", "en");
    expect(a.tiles.map((t) => t.id)).toEqual(b.tiles.map((t) => t.id));
  });

  it("produces a different arrangement for a different seed", () => {
    const a = createWordOrderPuzzle("one two three four five six", "en", 1);
    const b = createWordOrderPuzzle("one two three four five six", "en", 999);
    expect(a.tiles.map((t) => t.id)).not.toEqual(b.tiles.map((t) => t.id));
  });

  it("never presents the tiles already in the correct order", () => {
    for (const text of ["one two", "one two three", "alpha beta gamma delta"]) {
      for (let seed = 0; seed < 25; seed++) {
        const puzzle = createWordOrderPuzzle(text, "en", seed);
        expect(puzzle.tiles.map((t) => t.text)).not.toEqual(puzzle.solution.map((t) => t.text));
      }
    }
  });

  it("tolerates a sentence where no distinct arrangement exists", () => {
    const puzzle = createWordOrderPuzzle("no no", "en", 7);
    expect(puzzle.tiles).toHaveLength(2);
  });

  it("handles a single-word sentence", () => {
    const puzzle = createWordOrderPuzzle("hello", "en");
    expect(puzzle.tiles.map((t) => t.text)).toEqual(["hello"]);
  });
});

describe("joinTokens", () => {
  it("joins English with spaces", () => {
    expect(joinTokens(buildTokens("i am hungry", "en"), "en")).toBe("i am hungry");
  });

  it("joins Thai without spaces, as Thai is written", () => {
    expect(joinTokens(buildTokens("ฉันหิวมาก", "th"), "th")).toBe("ฉันหิวมาก");
  });

  it("round-trips a Thai sentence back to something the checker accepts", () => {
    const puzzle = createWordOrderPuzzle("พรุ่งนี้ฉันจะโทรหาคุณ", "th");
    const answer = joinTokens(puzzle.solution, "th");
    expect(checkAnswer(answer, "พรุ่งนี้ฉันจะโทรหาคุณ", { language: "th" }).correct).toBe(true);
  });

  it("marks a wrong Thai order as incorrect", () => {
    const puzzle = createWordOrderPuzzle("พรุ่งนี้ฉันจะโทรหาคุณ", "th");
    const answer = joinTokens([...puzzle.solution].reverse(), "th");
    expect(checkAnswer(answer, "พรุ่งนี้ฉันจะโทรหาคุณ", { language: "th" }).correct).toBe(false);
  });
});

describe("isComplete", () => {
  it("is true only when every tile has been placed", () => {
    const puzzle = createWordOrderPuzzle("one two three", "en");
    expect(isComplete(puzzle, puzzle.tiles.slice(0, 2))).toBe(false);
    expect(isComplete(puzzle, puzzle.tiles)).toBe(true);
  });
});
