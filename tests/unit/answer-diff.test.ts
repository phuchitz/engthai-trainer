import { describe, it, expect } from "vitest";
import {
  alignWords,
  extraWords,
  levenshtein,
  missingWords,
  similarity,
  substitutedWords,
  tokenizeEnglish,
  tokenizeThai,
} from "@/lib/answer";

describe("levenshtein", () => {
  it("is zero for identical strings", () => {
    expect(levenshtein("hungry", "hungry")).toBe(0);
  });

  it("counts a single substitution, insertion and deletion", () => {
    expect(levenshtein("cat", "cut")).toBe(1);
    expect(levenshtein("cat", "cart")).toBe(1);
    expect(levenshtein("cart", "cat")).toBe(1);
  });

  it("handles an empty operand", () => {
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("abc", "")).toBe(3);
    expect(levenshtein("", "")).toBe(0);
  });

  it("is symmetric", () => {
    expect(levenshtein("kitten", "sitting")).toBe(levenshtein("sitting", "kitten"));
    expect(levenshtein("kitten", "sitting")).toBe(3);
  });

  it("counts an astral character as one edit", () => {
    expect(levenshtein("a😀b", "ab")).toBe(1);
  });
});

describe("similarity", () => {
  it("is 1 for identical words and 0 for nothing in common", () => {
    expect(similarity("hungry", "hungry")).toBe(1);
    expect(similarity("abc", "xyz")).toBe(0);
  });

  it("scores a one-character typo highly", () => {
    expect(similarity("hungry", "hungy")).toBeCloseTo(1 - 1 / 6, 5);
  });

  it("treats two empty strings as identical", () => {
    expect(similarity("", "")).toBe(1);
  });

  it("is symmetric", () => {
    expect(similarity("tomorrow", "tomorow")).toBe(similarity("tomorow", "tomorrow"));
  });
});

describe("tokenize", () => {
  it("splits English on whitespace", () => {
    expect(tokenizeEnglish("i am very hungry")).toEqual(["i", "am", "very", "hungry"]);
  });

  it("returns no tokens for an empty string", () => {
    expect(tokenizeEnglish("")).toEqual([]);
    expect(tokenizeThai("")).toEqual([]);
  });

  it("segments Thai, which is written without spaces", () => {
    expect(tokenizeThai("ฉันหิวมาก")).toEqual(["ฉัน", "หิว", "มาก"]);
  });

  it("drops punctuation between Thai words", () => {
    expect(tokenizeThai("ฉันหิวมาก!")).toEqual(["ฉัน", "หิว", "มาก"]);
  });
});

const en = (text: string) => tokenizeEnglish(text);

describe("alignWords", () => {
  it("reports every word as a match for an identical sentence", () => {
    const alignment = alignWords(en("i am very hungry"), en("i am very hungry"));
    expect(alignment.cost).toBe(0);
    expect(alignment.ops.every((op) => op.type === "match")).toBe(true);
    expect(alignment.ops).toHaveLength(4);
  });

  it("identifies a missing word", () => {
    const alignment = alignWords(en("i am very hungry"), en("i am hungry"));
    expect(missingWords(alignment)).toEqual(["very"]);
    expect(extraWords(alignment)).toEqual([]);
    expect(alignment.cost).toBe(1);
  });

  it("identifies an extra word", () => {
    const alignment = alignWords(en("i am hungry"), en("i am very hungry"));
    expect(extraWords(alignment)).toEqual(["very"]);
    expect(missingWords(alignment)).toEqual([]);
  });

  it("identifies a substituted word rather than a missing and extra pair", () => {
    const alignment = alignWords(en("i am very hungry"), en("i am very thirsty"));
    expect(substitutedWords(alignment)).toEqual([{ expected: "hungry", received: "thirsty" }]);
    expect(missingWords(alignment)).toEqual([]);
    expect(extraWords(alignment)).toEqual([]);
  });

  it("records how close a substituted word was", () => {
    const alignment = alignWords(en("i am hungry"), en("i am hungy"));
    const substitution = alignment.ops.find((op) => op.type === "substituted");
    expect(substitution).toBeDefined();
    expect(substitution!.type === "substituted" && substitution!.similarity).toBeCloseTo(1 - 1 / 6, 5);
  });

  it("charges less for a near-miss than for an unrelated word", () => {
    const typo = alignWords(en("i am hungry"), en("i am hungy"));
    const wrong = alignWords(en("i am hungry"), en("i am purple"));
    expect(typo.cost).toBeLessThan(wrong.cost);
  });

  it("reports indexes into both sequences", () => {
    const alignment = alignWords(en("a b c"), en("a x c"));
    const substitution = alignment.ops.find((op) => op.type === "substituted");
    expect(substitution).toMatchObject({ expectedIndex: 1, receivedIndex: 1 });
  });

  it("keeps ops in reading order", () => {
    const alignment = alignWords(en("one two three four"), en("one three four five"));
    expect(alignment.ops.map((op) => op.type)).toEqual(["match", "missing", "match", "match", "extra"]);
  });

  it("handles an empty answer as all words missing", () => {
    const alignment = alignWords(en("i am hungry"), []);
    expect(missingWords(alignment)).toEqual(["i", "am", "hungry"]);
    expect(alignment.cost).toBe(3);
  });

  it("handles an empty expectation as all words extra", () => {
    const alignment = alignWords([], en("i am hungry"));
    expect(extraWords(alignment)).toEqual(["i", "am", "hungry"]);
  });

  it("produces no ops when both sides are empty", () => {
    const alignment = alignWords([], []);
    expect(alignment.ops).toEqual([]);
    expect(alignment.cost).toBe(0);
  });

  it("detects reordering as a substitution pair rather than silently accepting it", () => {
    const alignment = alignWords(en("tomorrow i will call"), en("i will call tomorrow"));
    expect(alignment.cost).toBeGreaterThan(0);
  });

  it("aligns Thai tokens", () => {
    const alignment = alignWords(tokenizeThai("ฉันหิวมาก"), tokenizeThai("ฉันหิว"));
    expect(missingWords(alignment)).toEqual(["มาก"]);
  });
});
