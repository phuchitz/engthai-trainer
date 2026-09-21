import { describe, it, expect } from "vitest";
import {
  buildVocabLookup,
  contextualMeaning,
  encounterCount,
  encounterCounts,
  lookupWord,
  sentencesByVocab,
  type EncounterAttempt,
} from "@/lib/study";
import type { Sentence, VocabularyEntry } from "@/lib/models";

const NOW = 1_700_000_000_000;

const sentence = (id: string, vocabIds: string[]): Pick<Sentence, "id" | "vocabIds"> => ({ id, vocabIds });

const attempt = (itemId: string): EncounterAttempt => ({ itemType: "sentence", itemId });

const entry = (
  over: Partial<VocabularyEntry> & Pick<VocabularyEntry, "id" | "en" | "th">,
): VocabularyEntry => ({
  forms: [],
  contexts: [],
  saved: false,
  exampleSentenceIds: [],
  tags: [],
  level: "A1",
  source: "builtin",
  createdAt: NOW,
  updatedAt: NOW,
  ...over,
});

const SENTENCES = [sentence("s1", ["v-blocker", "v-today"]), sentence("s2", ["v-today"]), sentence("s3", [])];

describe("sentencesByVocab", () => {
  it("maps each word to every sentence that uses it", () => {
    const map = sentencesByVocab(SENTENCES);
    expect([...(map.get("v-today") ?? [])].sort()).toEqual(["s1", "s2"]);
    expect([...(map.get("v-blocker") ?? [])]).toEqual(["s1"]);
  });

  it("omits words no sentence links to", () => {
    expect(sentencesByVocab(SENTENCES).has("v-unused")).toBe(false);
  });

  it("handles a library with no links at all", () => {
    expect(sentencesByVocab([sentence("s1", [])]).size).toBe(0);
  });
});

describe("encounterCount", () => {
  it("is zero before anything is practised", () => {
    expect(encounterCount([], new Set(["s1"]))).toBe(0);
  });

  it("counts one per attempt on a sentence containing the word", () => {
    expect(encounterCount([attempt("s1")], new Set(["s1"]))).toBe(1);
  });

  it("counts repeats, because the word came up each time", () => {
    expect(encounterCount([attempt("s1"), attempt("s1"), attempt("s1")], new Set(["s1"]))).toBe(3);
  });

  it("adds up across every sentence the word appears in", () => {
    expect(encounterCount([attempt("s1"), attempt("s2")], new Set(["s1", "s2"]))).toBe(2);
  });

  it("ignores attempts on sentences without the word", () => {
    expect(encounterCount([attempt("s3"), attempt("s2")], new Set(["s1"]))).toBe(0);
  });

  it("ignores vocabulary attempts, which are not sentence encounters", () => {
    const vocabAttempt = { itemType: "vocab" as const, itemId: "s1" };
    expect(encounterCount([vocabAttempt], new Set(["s1"]))).toBe(0);
  });

  it("is zero for a word linked to no sentence", () => {
    expect(encounterCount([attempt("s1")], new Set())).toBe(0);
  });
});

describe("encounterCounts", () => {
  it("derives a count for every linked word", () => {
    const counts = encounterCounts([attempt("s1"), attempt("s2"), attempt("s2")], SENTENCES);
    expect(counts.get("v-blocker")).toBe(1);
    // s1 once plus s2 twice.
    expect(counts.get("v-today")).toBe(3);
  });

  it("reports zero rather than omitting an unpractised word", () => {
    const counts = encounterCounts([], SENTENCES);
    expect(counts.get("v-blocker")).toBe(0);
    expect(counts.get("v-today")).toBe(0);
  });

  it("grows as attempts accumulate, without any stored counter", () => {
    const before = encounterCounts([attempt("s1")], SENTENCES).get("v-blocker");
    const after = encounterCounts([attempt("s1"), attempt("s1")], SENTENCES).get("v-blocker");
    expect(before).toBe(1);
    expect(after).toBe(2);
  });

  it("is derived purely from its inputs", () => {
    const attempts = [attempt("s1")];
    expect(encounterCounts(attempts, SENTENCES)).toEqual(encounterCounts(attempts, SENTENCES));
  });
});

describe("buildVocabLookup", () => {
  const blocker = entry({ id: "v-blocker", en: "blocker", th: "สิ่งที่ติดขัด", forms: ["blockers"] });
  const call = entry({ id: "v-call", en: "call", th: "โทรหา", forms: ["calls", "called", "calling"] });
  const lookup = buildVocabLookup([blocker, call]);

  it("finds a headword", () => {
    expect(lookupWord(lookup, "blocker")?.id).toBe("v-blocker");
  });

  it("finds a curated inflection", () => {
    expect(lookupWord(lookup, "blockers")?.id).toBe("v-blocker");
    expect(lookupWord(lookup, "calling")?.id).toBe("v-call");
  });

  it("ignores case and trailing punctuation the way the answer checker does", () => {
    expect(lookupWord(lookup, "Blockers")?.id).toBe("v-blocker");
    expect(lookupWord(lookup, "blockers?")?.id).toBe("v-blocker");
    expect(lookupWord(lookup, "  call.  ")?.id).toBe("v-call");
  });

  it("returns nothing for a word with no curated entry, rather than guessing", () => {
    expect(lookupWord(lookup, "unblocked")).toBeUndefined();
    expect(lookupWord(lookup, "recalling")).toBeUndefined();
  });

  it("does not stem, so a near-miss never resolves to the wrong definition", () => {
    // "blocking" is not an authored form of "blocker".
    expect(lookupWord(lookup, "blocking")).toBeUndefined();
  });

  it("returns nothing for an empty lookup", () => {
    expect(lookupWord(buildVocabLookup([]), "blocker")).toBeUndefined();
  });

  it("keeps the first entry when two words claim the same form", () => {
    const duplicate = entry({ id: "v-other", en: "blocker", th: "อื่น" });
    expect(lookupWord(buildVocabLookup([blocker, duplicate]), "blocker")?.id).toBe("v-blocker");
  });
});

describe("contextualMeaning", () => {
  const word = entry({
    id: "v-review",
    en: "review",
    th: "รีวิว",
    contexts: [{ sentenceId: "s1", meaning: "ตรวจโค้ด" }],
  });

  it("returns the note authored for that sentence", () => {
    expect(contextualMeaning(word, "s1")).toBe("ตรวจโค้ด");
  });

  it("returns nothing for a sentence with no authored note", () => {
    expect(contextualMeaning(word, "s2")).toBeUndefined();
  });
});
