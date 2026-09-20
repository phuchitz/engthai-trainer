import { describe, it, expect } from "vitest";
import { normalizeEnglish, normalizeThai, normalizeAnswer } from "@/lib/answer";

describe("normalizeEnglish — case", () => {
  it("lowercases by default", () => {
    expect(normalizeEnglish("Where Are You GOING")).toBe("where are you going");
  });

  it("preserves case when asked", () => {
    expect(normalizeEnglish("Where Are You", { ignoreCase: false })).toBe("Where Are You");
  });

  it("folds a non-ASCII capital", () => {
    expect(normalizeEnglish("Élan")).toBe("élan");
  });
});

describe("normalizeEnglish — whitespace", () => {
  it("trims both ends", () => {
    expect(normalizeEnglish("   hello   ")).toBe("hello");
  });

  it("collapses runs of spaces", () => {
    expect(normalizeEnglish("hello     world")).toBe("hello world");
  });

  it("collapses tabs and newlines", () => {
    expect(normalizeEnglish("hello\t\tworld\nagain")).toBe("hello world again");
  });

  it("collapses a non-breaking space", () => {
    expect(normalizeEnglish("hello world")).toBe("hello world");
  });

  it("returns an empty string for whitespace only", () => {
    expect(normalizeEnglish("  \t \n ")).toBe("");
  });
});

describe("normalizeEnglish — apostrophes", () => {
  it("converts a curly apostrophe to a straight one", () => {
    expect(normalizeEnglish("don’t")).toBe("don't");
  });

  it("treats every apostrophe variant as the same character", () => {
    const forms = ["don't", "don’t", "don‘t", "donʼt", "don′t", "don´t"];
    const normalized = new Set(forms.map((f) => normalizeEnglish(f)));
    expect(normalized).toEqual(new Set(["don't"]));
  });

  it("keeps the apostrophe inside a contraction", () => {
    expect(normalizeEnglish("I'm he's they've we'll it's")).toBe("i'm he's they've we'll it's");
  });

  it("keeps an apostrophe in a possessive", () => {
    expect(normalizeEnglish("the dog's bowl")).toBe("the dog's bowl");
  });

  it("removes apostrophes used as quotation marks", () => {
    expect(normalizeEnglish("'hello' she said")).toBe("hello she said");
  });

  it("removes a trailing plural possessive apostrophe", () => {
    expect(normalizeEnglish("the dogs' bowls")).toBe("the dogs bowls");
  });

  it("does not merge a contraction into its expansion", () => {
    expect(normalizeEnglish("don't")).not.toBe(normalizeEnglish("do not"));
  });
});

describe("normalizeEnglish — punctuation", () => {
  it("removes sentence-ending punctuation", () => {
    expect(normalizeEnglish("Where are you going?")).toBe("where are you going");
    expect(normalizeEnglish("Stop!")).toBe("stop");
    expect(normalizeEnglish("Yes, of course.")).toBe("yes of course");
  });

  it("removes quotes, brackets and ellipses", () => {
    expect(normalizeEnglish('"Hello" (again) [now] {here}…')).toBe("hello again now here");
  });

  it("removes colons and semicolons", () => {
    expect(normalizeEnglish("first; second: third")).toBe("first second third");
  });

  it("keeps a hyphen inside a compound word", () => {
    expect(normalizeEnglish("a well-known author")).toBe("a well-known author");
  });

  it("removes a dash used as punctuation", () => {
    expect(normalizeEnglish("wait — stop")).toBe("wait stop");
    expect(normalizeEnglish("wait - stop")).toBe("wait stop");
  });

  it("treats every dash variant the same inside a word", () => {
    expect(normalizeEnglish("well‐known")).toBe("well-known");
    expect(normalizeEnglish("well–known")).toBe("well-known");
  });

  it("keeps punctuation when asked", () => {
    expect(normalizeEnglish("Hello, world!", { ignorePunctuation: false })).toBe("hello, world!");
  });

  it("leaves digits alone", () => {
    expect(normalizeEnglish("I have 3 cats.")).toBe("i have 3 cats");
  });

  it("reduces a string of only punctuation to empty", () => {
    expect(normalizeEnglish("!!! ... ???")).toBe("");
  });
});

describe("normalizeEnglish — invisible characters", () => {
  it("strips zero-width characters and the BOM", () => {
    expect(normalizeEnglish("hel​lo﻿ world")).toBe("hello world");
  });

  it("composes decomposed characters so equality holds", () => {
    const composed = "café";
    const decomposed = "café";
    expect(normalizeEnglish(decomposed)).toBe(normalizeEnglish(composed));
  });
});

describe("normalizeThai", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeThai("  ฉันหิวมาก  ")).toBe("ฉันหิวมาก");
    expect(normalizeThai("ฉัน   หิว")).toBe("ฉัน หิว");
  });

  it("strips zero-width characters", () => {
    expect(normalizeThai("ฉัน​หิวมาก")).toBe("ฉันหิวมาก");
  });

  it("keeps tone marks, because they change the word", () => {
    const withTone = "พรุ่งนี้";
    expect(normalizeThai(withTone)).toBe(withTone);
    expect(normalizeThai("ไหม")).not.toBe(normalizeThai("ไหม่"));
  });

  it("keeps vowel signs", () => {
    expect(normalizeThai("หิว")).not.toBe(normalizeThai("หว"));
  });

  it("keeps the repetition mark", () => {
    expect(normalizeThai("เด็กๆ")).toBe("เด็กๆ");
    expect(normalizeThai("เด็กๆ")).not.toBe(normalizeThai("เด็ก"));
  });

  it("does not lowercase or strip punctuation, since Thai uses neither", () => {
    expect(normalizeThai("ABC ฉัน")).toBe("ABC ฉัน");
  });

  it("composes Thai text to NFC", () => {
    const text = "ฉันหิวมาก";
    expect(normalizeThai(text.normalize("NFD"))).toBe(text.normalize("NFC"));
  });

  it("returns empty for whitespace only", () => {
    expect(normalizeThai("   ")).toBe("");
  });
});

describe("normalizeAnswer", () => {
  it("dispatches on language", () => {
    expect(normalizeAnswer("Hello, World!", "en")).toBe("hello world");
    expect(normalizeAnswer("  ฉันหิวมาก ", "th")).toBe("ฉันหิวมาก");
  });

  it("does not apply English punctuation rules to Thai", () => {
    expect(normalizeAnswer("ฉันหิวมาก!", "th")).toBe("ฉันหิวมาก!");
  });
});
