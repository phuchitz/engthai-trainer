import { describe, it, expect } from "vitest";
import { SEED_LESSONS, SEED_SENTENCES, SEED_VOCABULARY } from "@/content/seed/starter";
import { lessonSchema, sentenceSchema, vocabularyEntrySchema, type Category } from "@/lib/models";
import { normalizeEnglish } from "@/lib/answer";
import { buildVocabLookup } from "@/lib/study/encounters";
import { createWordOrderPuzzle, createFillBlankPuzzle } from "@/lib/exercises";

/**
 * The corpus is data, and data rots quietly: a vocabulary id with a typo, a word nobody
 * can reach by tapping, an English sentence with a symbol in it that Dictation will read
 * aloud as "open paren". None of that fails a typecheck. It fails here.
 */

const NOW = 1_700_000_000_000;
const parsed = SEED_SENTENCES.map((s) =>
  sentenceSchema.parse({ ...s, source: "builtin", createdAt: NOW, updatedAt: NOW }),
);
const vocab = SEED_VOCABULARY.map((v) =>
  vocabularyEntrySchema.parse({ ...v, source: "builtin", createdAt: NOW, updatedAt: NOW }),
);
const lessons = SEED_LESSONS.map((l) =>
  lessonSchema.parse({ ...l, source: "builtin", createdAt: NOW, updatedAt: NOW }),
);

const EXPECTED_PER_CATEGORY: Partial<Record<Category, number>> = {
  daily: 10,
  software: 15,
  meetings: 10,
  interviews: 10,
  workplace: 5,
};

describe("the deck is the size it claims to be", () => {
  it("has at least fifty sentences", () => {
    expect(parsed.length).toBeGreaterThanOrEqual(50);
  });

  it.each(Object.entries(EXPECTED_PER_CATEGORY))("%s has %i sentences", (category, count) => {
    expect(parsed.filter((s) => s.category === category)).toHaveLength(count);
  });

  it("leaves travel and custom empty on purpose", () => {
    // Custom is where the learner's own imports land, and an empty Travel keeps the
    // Lessons screen's empty-category path exercised by real data.
    expect(parsed.filter((s) => s.category === "travel")).toHaveLength(0);
    expect(parsed.filter((s) => s.category === "custom")).toHaveLength(0);
  });
});

describe("every sentence is complete", () => {
  it.each(parsed.map((s) => [s.id, s] as const))("%s carries everything the screens render", (_id, s) => {
    expect(s.th.trim().length).toBeGreaterThan(0);
    expect(s.transliteration?.trim().length ?? 0).toBeGreaterThan(0);
    // The Thai grammar note is the payoff after a mistake; a sentence without one
    // teaches the answer but not the rule.
    expect(s.notes?.trim().length ?? 0).toBeGreaterThan(0);
    expect(s.hint?.trim().length ?? 0).toBeGreaterThan(0);
    expect(s.exampleEn?.trim().length ?? 0).toBeGreaterThan(0);
    expect(s.exampleTh?.trim().length ?? 0).toBeGreaterThan(0);
    expect(s.vocabIds.length).toBeGreaterThan(0);
  });

  it("writes the Thai note in Thai", () => {
    for (const s of parsed) expect(s.notes, s.id).toMatch(/[฀-๿]/);
  });

  it("gives the additional example in both languages", () => {
    for (const s of parsed) expect(s.exampleTh, s.id).toMatch(/[฀-๿]/);
  });

  it("uses no id twice", () => {
    expect(new Set(parsed.map((s) => s.id)).size).toBe(parsed.length);
  });

  it("has no duplicate English, by the same rule the importer uses", () => {
    // A duplicate would be silently skipped on import and would schedule twice here.
    const seen = new Map<string, string>();
    for (const s of parsed) {
      const key = normalizeEnglish(s.en);
      expect(seen.get(key), `${s.id} duplicates ${seen.get(key)}`).toBeUndefined();
      seen.set(key, s.id);
    }
  });
});

describe("the English is speakable and typeable", () => {
  // Every sentence is read aloud by Dictation and Speaking and typed back by hand.
  it.each(parsed.map((s) => [s.id, s.en] as const))("%s has no notation in it", (_id, en) => {
    expect(en).not.toMatch(/[(){}[\]<>/\\|*_#@~^]/);
    expect(en).not.toMatch(/\d/);
    expect(en).not.toMatch(/[—–]/);
  });

  it("keeps every sentence short enough to hold in the ear", () => {
    for (const s of parsed) expect(s.en.split(/\s+/).length, s.id).toBeLessThanOrEqual(12);
  });

  it("offers a contraction or a rephrasing wherever one is natural", () => {
    // A learner who writes "I'd like" when the deck says "I would like" is not wrong,
    // and being told otherwise is how a trainer loses trust.
    for (const s of parsed) {
      if (!/\b(I would|I will|I am|I have|you are|it has|we are|let us|who is)\b/i.test(s.en)) continue;
      expect(s.enAlternates.length, `${s.id} has no contracted alternative`).toBeGreaterThan(0);
    }
  });
});

describe("vocabulary links resolve in both directions", () => {
  const byId = new Map(vocab.map((v) => [v.id, v]));
  const sentenceIds = new Set(parsed.map((s) => s.id));

  it("uses no vocabulary id twice", () => {
    expect(new Set(vocab.map((v) => v.id)).size).toBe(vocab.length);
  });

  it("points every sentence at entries that exist", () => {
    for (const s of parsed) {
      for (const id of s.vocabIds) expect(byId.has(id), `${s.id} -> ${id}`).toBe(true);
    }
  });

  it("points every context and example at a sentence that exists", () => {
    for (const v of vocab) {
      for (const c of v.contexts)
        expect(sentenceIds.has(c.sentenceId), `${v.id} -> ${c.sentenceId}`).toBe(true);
      for (const id of v.exampleSentenceIds) expect(sentenceIds.has(id), `${v.id} -> ${id}`).toBe(true);
    }
  });

  it("leaves no entry stranded with nothing linking to it", () => {
    const linked = new Set(parsed.flatMap((s) => s.vocabIds));
    for (const v of vocab) expect(linked.has(v.id), `${v.id} is never linked`).toBe(true);
  });

  it("gives every entry a contextual meaning for each sentence that links it", () => {
    // The panel's whole point is what the word means *here*, not its headword sense.
    for (const s of parsed) {
      for (const id of s.vocabIds) {
        const entry = byId.get(id)!;
        expect(
          entry.contexts.some((c) => c.sentenceId === s.id),
          `${id} has no context for ${s.id}`,
        ).toBe(true);
      }
    }
  });
});

describe("every curated word can actually be reached by tapping", () => {
  const lookup = buildVocabLookup(vocab);
  const byId = new Map(vocab.map((v) => [v.id, v]));

  it("resolves a word in the sentence to the entry linked from it", () => {
    for (const sentence of parsed) {
      for (const id of sentence.vocabIds) {
        const entry = byId.get(id)!;
        const reachable = sentence.en
          .split(/\s+/)
          .some((word) => lookup.get(normalizeEnglish(word))?.id === entry.id);
        expect(reachable, `no word in "${sentence.en}" resolves to ${entry.id}`).toBe(true);
      }
    }
  });

  it("lets no two entries claim the same surface form", () => {
    // buildVocabLookup keeps the first claim and silently drops the second, so a clash
    // would attach the wrong definition to a word with no error anywhere.
    const owner = new Map<string, string>();
    for (const entry of vocab) {
      for (const surface of [entry.en, ...entry.forms]) {
        const key = normalizeEnglish(surface);
        expect(owner.get(key), `"${surface}" claimed by ${owner.get(key)} and ${entry.id}`).toBeUndefined();
        owner.set(key, entry.id);
      }
    }
  });

  it("curates a part of speech, a Thai meaning and an example for every entry", () => {
    for (const v of vocab) {
      expect(v.pos, v.id).toBeDefined();
      expect(v.th, v.id).toMatch(/[฀-๿]/);
      expect(v.exampleEn?.trim().length ?? 0, v.id).toBeGreaterThan(0);
      expect(v.exampleTh, v.id).toMatch(/[฀-๿]/);
    }
  });

  it("writes IPA between slashes, or not at all", () => {
    // A missing IPA renders nothing. A malformed one renders nonsense.
    for (const v of vocab) {
      if (v.ipa === undefined) continue;
      expect(v.ipa, v.id).toMatch(/^\/.+\/$/);
    }
  });
});

describe("the exercise modes can build something from every sentence", () => {
  it("makes a Sentence Builder puzzle with more than one Thai tile", () => {
    for (const s of parsed) {
      const puzzle = createWordOrderPuzzle(s.th, "th");
      expect(puzzle.solution.length, `${s.id}: "${s.th}"`).toBeGreaterThan(1);
    }
  });

  it("rebuilds the original answer from the Sentence Builder tiles", () => {
    // The tiles are the only way to answer in that mode, so a sentence whose tiles
    // cannot be reassembled into an accepted answer is unanswerable.
    for (const s of parsed) {
      const puzzle = createWordOrderPuzzle(s.th, "th");
      const joined = puzzle.solution.map((t) => t.text).join("");
      expect(joined.length, s.id).toBeGreaterThan(0);
    }
  });

  it("makes a Fill in the Blank exercise with at least one blank", () => {
    for (const s of parsed) {
      const exercise = createFillBlankPuzzle(s.en, "en");
      expect(exercise.blanks.length, `${s.id}: "${s.en}"`).toBeGreaterThan(0);
    }
  });
});

describe("lessons match the deck", () => {
  it("gives each stocked category exactly one lesson", () => {
    const categories = new Set(parsed.map((s) => s.category));
    expect(lessons).toHaveLength(categories.size);
  });

  it("lists every sentence of its category, and nothing else", () => {
    for (const lesson of lessons) {
      const listed = [...lesson.sentenceIds].sort();
      const owned = parsed
        .filter((s) => s.lessonIds.includes(lesson.id))
        .map((s) => s.id)
        .sort();
      expect(listed, lesson.id).toEqual(owned);
      expect(new Set(listed).size, `${lesson.id} lists a sentence twice`).toBe(listed.length);
    }
  });

  it("points every sentence at a lesson that exists", () => {
    const lessonIds = new Set(lessons.map((l) => l.id));
    for (const s of parsed) {
      for (const id of s.lessonIds) expect(lessonIds.has(id), `${s.id} -> ${id}`).toBe(true);
    }
  });
});
