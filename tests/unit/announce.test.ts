import { describe, it, expect } from "vitest";
import { announceResult, checkAnswer } from "@/lib/answer";

const check = (expected: string, user: string, alternatives?: string[]) =>
  checkAnswer(user, expected, { language: "en", alternatives });

describe("announceResult", () => {
  it("leads with the verdict and the score, the two things the colour conveys", () => {
    const text = announceResult(check("I am hungry", "I am hungry"));
    expect(text.startsWith("Perfect. 100 percent.")).toBe(true);
  });

  it("says the answer was right rather than listing nothing", () => {
    expect(announceResult(check("I am hungry", "I am hungry"))).toContain("Every word is correct.");
  });

  it("credits an accepted alternative instead of calling it a lucky match", () => {
    const result = check("I am hungry", "I'm hungry", ["I'm hungry"]);
    expect(result.correct).toBe(true);
    expect(announceResult(result)).toContain("accepted alternative");
  });

  it("names the missing words, because the diff is a colour on screen", () => {
    const text = announceResult(check("I would like a coffee please", "I would like coffee"));
    expect(text).toMatch(/Missing words?: /);
    expect(text).toContain("“a”");
    expect(text).toContain("“please”");
  });

  it("names extra words", () => {
    expect(announceResult(check("I am hungry", "I am very hungry"))).toContain("Extra word: “very”");
  });

  it("reads a substitution as received-should-be-expected", () => {
    const text = announceResult(check("see you tomorrow", "see you yesterday"));
    expect(text).toContain("“yesterday” should be “tomorrow”");
  });

  it("caps a long list so one bad answer is not read out for a minute", () => {
    const expected = "one two three four five six seven eight nine ten";
    const text = announceResult(check(expected, "one"));
    expect(text).toContain("and 6 more");
    expect(text).not.toContain("“ten”");
  });

  it("always gives the expected answer when the attempt was wrong", () => {
    expect(announceResult(check("I am hungry", "hungry"))).toContain("Expected: I am hungry.");
  });

  it("does not double the full stop on a sentence that already has one", () => {
    // A screen reader reads "..", so the sentence's own punctuation is left alone.
    const text = announceResult(check("I am very hungry.", "wrong"));
    expect(text).toContain("Expected: I am very hungry.");
    expect(text).not.toContain("hungry..");
  });

  it("still ends the sentence when the answer has no punctuation of its own", () => {
    expect(announceResult(check("I am hungry", "wrong"))).toContain("Expected: I am hungry.");
  });

  it("mentions XP only when XP was actually paid", () => {
    const result = check("I am hungry", "I am hungry");
    expect(announceResult(result, { xpAwarded: 10 })).toContain("Plus 10 XP.");
    expect(announceResult(result, { xpAwarded: 0 })).not.toContain("XP");
    expect(announceResult(result)).not.toContain("XP");
  });

  it("repeats the caveats the sighted learner can read", () => {
    const result = check("I am hungry", "I am angry");
    expect(announceResult(result, { transcriptOnly: true })).toContain("not pronunciation");
    expect(announceResult(result, { blanksOnly: true })).toContain("Only the missing words were scored.");
  });

  it("survives an empty answer", () => {
    const text = announceResult(check("I am hungry", ""));
    expect(text).toContain("0 percent");
    expect(text).toContain("Expected: I am hungry.");
  });
});
