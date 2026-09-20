import { describe, it, expect } from "vitest";
import { accuracyFromAlignment, alignWords, bandFor, checkAnswer, tokenizeEnglish } from "@/lib/answer";

const check = (user: string, expected: string, alternatives?: string[]) =>
  checkAnswer(user, expected, { language: "en", alternatives });

const checkThai = (user: string, expected: string, alternatives?: string[]) =>
  checkAnswer(user, expected, { language: "th", alternatives });

describe("bandFor — boundaries", () => {
  it("maps each documented band", () => {
    expect(bandFor(100)).toBe("perfect");
    expect(bandFor(99)).toBe("great");
    expect(bandFor(85)).toBe("great");
    expect(bandFor(84)).toBe("good");
    expect(bandFor(70)).toBe("good");
    expect(bandFor(69)).toBe("tryAgain");
    expect(bandFor(0)).toBe("tryAgain");
  });
});

describe("accuracyFromAlignment", () => {
  const score = (expected: string, received: string) => {
    const e = tokenizeEnglish(expected);
    const r = tokenizeEnglish(received);
    return accuracyFromAlignment(alignWords(e, r), e.length, r.length);
  };

  it("is 100 only for a zero-cost alignment", () => {
    expect(score("i am hungry", "i am hungry")).toBe(100);
  });

  it("never rounds an imperfect answer up to 100", () => {
    const expected = Array.from({ length: 60 }, (_, i) => `word${i}`).join(" ");
    const received = expected.replace("word59", "word5x");
    expect(score(expected, received)).toBeLessThanOrEqual(99);
  });

  it("penalises a missing word proportionally to sentence length", () => {
    expect(score("one two three four", "one two three")).toBe(75);
  });

  it("penalises extra words as well as missing ones", () => {
    expect(score("one two", "one two three four")).toBe(50);
  });

  it("is 0 when nothing matches", () => {
    expect(score("one two three", "alpha beta gamma")).toBe(0);
  });

  it("is 0 rather than NaN when both sides are empty", () => {
    expect(accuracyFromAlignment(alignWords([], []), 0, 0)).toBe(0);
  });

  it("stays within 0 and 100", () => {
    for (const [expected, received] of [
      ["a", "a b c d e f g"],
      ["a b c d e f g", "a"],
      ["", "a b c"],
    ]) {
      const value = score(expected, received);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
  });
});

describe("checkAnswer — exact matches", () => {
  it("accepts an identical answer", () => {
    const result = check("I am very hungry.", "I am very hungry.");
    expect(result.correct).toBe(true);
    expect(result.accuracy).toBe(100);
    expect(result.band).toBe("perfect");
  });

  it("ignores case, punctuation and surrounding whitespace", () => {
    const result = check("  where ARE you going  ", "Where are you going?");
    expect(result.correct).toBe(true);
    expect(result.band).toBe("perfect");
  });

  it("accepts a curly apostrophe where a straight one was authored", () => {
    expect(check("I’m very hungry", "I'm very hungry").correct).toBe(true);
  });

  it("accepts a straight apostrophe where a curly one was authored", () => {
    expect(check("I'm very hungry", "I’m very hungry").correct).toBe(true);
  });

  it("does not accept the expansion of a contraction as identical", () => {
    const result = check("I am very hungry", "I'm very hungry");
    expect(result.correct).toBe(false);
  });
});

describe("checkAnswer — near misses", () => {
  it("scores a single typo as Great rather than wrong", () => {
    const result = check("i am very hungy", "I am very hungry");
    expect(result.correct).toBe(false);
    expect(result.band).toBe("great");
    expect(result.substituted).toEqual([{ expected: "hungry", received: "hungy" }]);
  });

  it("reports a missing word", () => {
    const result = check("i am hungry", "I am very hungry");
    expect(result.missing).toEqual(["very"]);
    expect(result.extra).toEqual([]);
    expect(result.accuracy).toBe(75);
    expect(result.band).toBe("good");
  });

  it("reports an extra word", () => {
    const result = check("i am very very hungry", "I am very hungry");
    expect(result.extra).toEqual(["very"]);
    expect(result.missing).toEqual([]);
  });

  it("falls to Try Again when the sentence is mostly wrong", () => {
    const result = check("the cat sat down", "I am very hungry");
    expect(result.band).toBe("tryAgain");
    expect(result.accuracy).toBeLessThan(70);
  });
});

describe("checkAnswer — accepted alternatives", () => {
  it("treats an authored alternative as fully correct", () => {
    const result = check("Where are you headed?", "Where are you going?", ["Where are you headed?"]);
    expect(result.correct).toBe(true);
    expect(result.accuracy).toBe(100);
    expect(result.band).toBe("perfect");
    expect(result.matchedAlternative).toBe(true);
    expect(result.matchedAnswer).toBe("Where are you headed?");
  });

  it("never reports an alternative as having missing or extra words", () => {
    const result = check("I'll call you tomorrow", "I will call you tomorrow", ["I'll call you tomorrow"]);
    expect(result.correct).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.extra).toEqual([]);
    expect(result.substituted).toEqual([]);
  });

  it("grades against the closest alternative, not the first one", () => {
    const result = check("i am starving", "I am very hungry", ["I am famished", "I am starving"]);
    expect(result.correct).toBe(true);
    expect(result.matchedAnswer).toBe("I am starving");
  });

  it("still prefers the primary answer when it matches exactly", () => {
    const result = check("I am very hungry", "I am very hungry", ["I am starving"]);
    expect(result.matchedAlternative).toBe(false);
    expect(result.matchedAnswer).toBe("I am very hungry");
  });

  it("reports the diff against whichever answer the learner came closest to", () => {
    const result = check("i am starvin", "I am very hungry", ["I am starving"]);
    expect(result.matchedAnswer).toBe("I am starving");
    expect(result.substituted).toEqual([{ expected: "starving", received: "starvin" }]);
  });

  it("applies the same normalization to alternatives", () => {
    expect(check("where are you headed", "Where are you going?", ["Where are you HEADED?"]).correct).toBe(
      true,
    );
  });

  it("behaves normally when no alternatives are supplied", () => {
    expect(check("i am very hungry", "I am very hungry").matchedAlternative).toBe(false);
  });
});

describe("checkAnswer — empty and degenerate input", () => {
  it("scores an empty answer as zero without throwing", () => {
    const result = check("", "I am very hungry");
    expect(result.correct).toBe(false);
    expect(result.accuracy).toBe(0);
    expect(result.band).toBe("tryAgain");
    expect(result.missing).toEqual(["i", "am", "very", "hungry"]);
  });

  it("treats whitespace as empty", () => {
    expect(check("   \n\t  ", "I am very hungry").accuracy).toBe(0);
  });

  it("treats punctuation-only input as empty", () => {
    expect(check("???!!!", "I am very hungry").accuracy).toBe(0);
  });

  it("never marks an empty answer correct, even against an empty expectation", () => {
    const result = check("", "");
    expect(result.correct).toBe(false);
    expect(result.band).toBe("tryAgain");
  });

  it("handles an answer far longer than expected", () => {
    const result = check("i am very hungry and also quite tired and going home now", "I am very hungry");
    expect(result.band).toBe("tryAgain");
    expect(result.extra.length).toBeGreaterThan(0);
  });
});

describe("checkAnswer — Thai is graded strictly", () => {
  it("accepts an exact answer", () => {
    const result = checkThai("ฉันหิวมาก", "ฉันหิวมาก");
    expect(result.correct).toBe(true);
    expect(result.band).toBe("perfect");
  });

  it("ignores only surrounding whitespace", () => {
    expect(checkThai("  ฉันหิวมาก  ", "ฉันหิวมาก").correct).toBe(true);
  });

  it("refuses a missing tone mark however close the answer looks", () => {
    const result = checkThai("พรุงนี้ฉันจะโทรหาคุณ", "พรุ่งนี้ฉันจะโทรหาคุณ");
    expect(result.correct).toBe(false);
    expect(result.band).toBe("tryAgain");
  });

  it("still reports how close a wrong Thai answer was", () => {
    const result = checkThai("พรุงนี้ฉันจะโทรหาคุณ", "พรุ่งนี้ฉันจะโทรหาคุณ");
    expect(result.accuracy).toBeGreaterThan(50);
    expect(result.accuracy).toBeLessThan(100);
  });

  it("never awards Great or Good to an inexact Thai answer", () => {
    // Six of the seven expected words, which would be "Great" in English.
    const result = checkThai("พรุ่งนี้ฉันจะโทรหา", "พรุ่งนี้ฉันจะโทรหาคุณ");
    expect(result.accuracy).toBeGreaterThanOrEqual(85);
    expect(result.band).toBe("tryAgain");
    expect(result.correct).toBe(false);
  });

  it("would have graded the same shape of answer as Great in English", () => {
    const english = checkAnswer("one two three four five six", "one two three four five six seven", {
      language: "en",
    });
    expect(english.band).toBe("great");
  });

  it("accepts an authored Thai alternative exactly", () => {
    const result = checkThai("คุณกำลังจะไปไหน", "คุณจะไปไหน", ["คุณกำลังจะไปไหน"]);
    expect(result.correct).toBe(true);
    expect(result.band).toBe("perfect");
  });

  it("scores an empty Thai answer as zero", () => {
    expect(checkThai("", "ฉันหิวมาก").accuracy).toBe(0);
  });

  it("reports which Thai words were missing", () => {
    expect(checkThai("ฉันหิว", "ฉันหิวมาก").missing).toEqual(["มาก"]);
  });
});

describe("checkAnswer — options", () => {
  it("can be made case sensitive", () => {
    const result = checkAnswer("where are you going", "Where are you going", {
      language: "en",
      ignoreCase: false,
    });
    expect(result.correct).toBe(false);
  });

  it("can be made punctuation sensitive", () => {
    const result = checkAnswer("Where are you going", "Where are you going?", {
      language: "en",
      ignorePunctuation: false,
    });
    expect(result.correct).toBe(false);
  });
});

describe("checkAnswer — purity", () => {
  it("does not mutate its inputs", () => {
    const alternatives = ["I am starving"];
    const frozen = Object.freeze([...alternatives]);
    expect(() => check("i am starving", "I am very hungry", frozen as string[])).not.toThrow();
    expect(alternatives).toEqual(["I am starving"]);
  });

  it("returns the same result for the same inputs", () => {
    const a = check("i am hungy", "I am very hungry", ["I am starving"]);
    const b = check("i am hungy", "I am very hungry", ["I am starving"]);
    expect(a).toEqual(b);
  });
});
