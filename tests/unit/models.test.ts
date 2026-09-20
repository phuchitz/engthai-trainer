import { describe, it, expect } from "vitest";
import {
  attemptSchema,
  defaultSettings,
  emptyMistakesByMode,
  lessonSchema,
  sentenceProgressSchema,
  sentenceSchema,
  settingsSchema,
  studySessionSchema,
  vocabularyEntrySchema,
} from "@/lib/models";

const NOW = 1_700_000_000_000;

const validSentence = {
  id: "s1",
  en: "I am very hungry.",
  th: "ฉันหิวมาก",
  level: "A1",
  source: "builtin",
  createdAt: NOW,
  updatedAt: NOW,
};

describe("sentenceSchema", () => {
  it("fills array defaults so callers never handle undefined", () => {
    const parsed = sentenceSchema.parse(validSentence);
    expect(parsed.enAlternates).toEqual([]);
    expect(parsed.tags).toEqual([]);
    expect(parsed.vocabIds).toEqual([]);
  });

  it("preserves Thai text exactly, including tone marks", () => {
    const parsed = sentenceSchema.parse({ ...validSentence, th: "พรุ่งนี้ฉันจะโทรหาคุณ" });
    expect(parsed.th).toBe("พรุ่งนี้ฉันจะโทรหาคุณ");
  });

  it("rejects an empty translation", () => {
    expect(() => sentenceSchema.parse({ ...validSentence, th: "" })).toThrow();
  });

  it("rejects an unknown level", () => {
    expect(() => sentenceSchema.parse({ ...validSentence, level: "Z9" })).toThrow();
  });

  it("rejects a non-numeric timestamp", () => {
    expect(() => sentenceSchema.parse({ ...validSentence, createdAt: "yesterday" })).toThrow();
  });
});

describe("vocabularyEntrySchema", () => {
  it("accepts an entry with a part of speech", () => {
    const parsed = vocabularyEntrySchema.parse({
      id: "v1",
      en: "hungry",
      th: "หิว",
      pos: "adjective",
      level: "A1",
      source: "builtin",
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(parsed.pos).toBe("adjective");
    expect(parsed.exampleSentenceIds).toEqual([]);
  });

  it("rejects an unknown part of speech", () => {
    expect(() =>
      vocabularyEntrySchema.parse({
        id: "v1",
        en: "hungry",
        th: "หิว",
        pos: "gerundive",
        level: "A1",
        source: "builtin",
        createdAt: NOW,
        updatedAt: NOW,
      }),
    ).toThrow();
  });
});

describe("sentenceProgressSchema", () => {
  const base = {
    id: "sentence:s1:en2th",
    itemType: "sentence",
    itemId: "s1",
    direction: "en2th",
    nextReviewAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
  };

  it("defaults every tracked counter to zero", () => {
    const parsed = sentenceProgressSchema.parse(base);
    expect(parsed.practiceCount).toBe(0);
    expect(parsed.correctCount).toBe(0);
    expect(parsed.incorrectCount).toBe(0);
    expect(parsed.consecutiveSuccesses).toBe(0);
    expect(parsed.lapses).toBe(0);
    expect(parsed.lastPracticedAt).toBeNull();
    expect(parsed.memoryLevel).toBe("new");
    expect(parsed.state).toBe("new");
    expect(parsed.suspended).toBe(false);
  });

  it("starts with a mistake counter for every exercise mode", () => {
    const parsed = sentenceProgressSchema.parse(base);
    expect(parsed.mistakesByMode).toEqual(emptyMistakesByMode());
    expect(parsed.mistakesByMode.wordOrder).toBe(0);
    expect(parsed.mistakesByMode.speak).toBe(0);
  });

  it("keeps difficulty and ease inside their scheduler ranges", () => {
    expect(() => sentenceProgressSchema.parse({ ...base, difficulty: 11 })).toThrow();
    expect(() => sentenceProgressSchema.parse({ ...base, ease: 1.0 })).toThrow();
    expect(sentenceProgressSchema.parse({ ...base, difficulty: 7.2, ease: 2.1 }).difficulty).toBe(7.2);
  });

  it("rejects a negative practice count", () => {
    expect(() => sentenceProgressSchema.parse({ ...base, practiceCount: -1 })).toThrow();
  });
});

describe("attemptSchema", () => {
  const base = {
    id: "a1",
    sessionId: "sess1",
    progressId: "sentence:s1:en2th",
    itemType: "sentence",
    itemId: "s1",
    direction: "en2th",
    mode: "translate",
    prompt: "I am very hungry.",
    userAnswer: "ฉันหิวมาก",
    expectedAnswer: "ฉันหิวมาก",
    verdict: "correct",
    grade: 3,
    createdAt: NOW,
  };

  it("accepts a graded attempt", () => {
    expect(attemptSchema.parse(base).grade).toBe(3);
  });

  it("rejects a grade outside the FSRS rating scale", () => {
    expect(() => attemptSchema.parse({ ...base, grade: 5 })).toThrow();
    expect(() => attemptSchema.parse({ ...base, grade: 0 })).toThrow();
  });

  it("rejects a similarity above 1", () => {
    expect(() => attemptSchema.parse({ ...base, similarity: 1.4 })).toThrow();
  });
});

describe("studySessionSchema", () => {
  it("allows an open session with no end time", () => {
    const parsed = studySessionSchema.parse({ id: "sess1", kind: "review", startedAt: NOW });
    expect(parsed.endedAt).toBeNull();
    expect(parsed.lessonId).toBeNull();
  });
});

describe("lessonSchema", () => {
  it("requires both titles", () => {
    expect(() =>
      lessonSchema.parse({
        id: "l1",
        title: "Basics",
        level: "A1",
        source: "builtin",
        createdAt: NOW,
        updatedAt: NOW,
      }),
    ).toThrow();
  });
});

describe("settingsSchema", () => {
  it("produces a complete default record", () => {
    const parsed = defaultSettings(NOW);
    expect(parsed.dailyGoal).toBe(20);
    expect(parsed.strictness).toBe("normal");
    expect(parsed.ai.enabled).toBe(false);
    expect(parsed.streak.current).toBe(0);
  });

  it("has no Thai-leniency switch, because typed Thai is always strict", () => {
    expect(defaultSettings(NOW)).not.toHaveProperty("ignoreThaiToneMarks");
  });

  it("backfills new defaults when parsing a record written by an older version", () => {
    const legacy = { id: "singleton", dailyGoal: 42, createdAt: NOW, updatedAt: NOW };
    const parsed = settingsSchema.parse(legacy);
    expect(parsed.dailyGoal).toBe(42);
    expect(parsed.maxReviewsPerDay).toBe(120);
    expect(parsed.streak.longest).toBe(0);
  });

  it("rejects an out-of-range daily goal", () => {
    expect(() =>
      settingsSchema.parse({ id: "singleton", dailyGoal: 0, createdAt: NOW, updatedAt: NOW }),
    ).toThrow();
  });
});
