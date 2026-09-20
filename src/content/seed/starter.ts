import type { Lesson, Sentence, VocabularyEntry } from "@/lib/models";

/**
 * Placeholder deck proving the loader works. The real ~150-sentence corpus arrives
 * in a later session; ids are stable strings so re-seeding matches existing rows
 * instead of inserting duplicates.
 */
export const SEED_VERSION = 1;

type SeedSentence = Omit<Sentence, "createdAt" | "updatedAt" | "source">;
type SeedVocab = Omit<VocabularyEntry, "createdAt" | "updatedAt" | "source">;
type SeedLesson = Omit<Lesson, "createdAt" | "updatedAt" | "source">;

export const SEED_VOCABULARY: SeedVocab[] = [
  {
    id: "seed-vocab-hungry",
    en: "hungry",
    th: "หิว",
    pos: "adjective",
    transliteration: "hiu",
    exampleSentenceIds: ["seed-sentence-0002"],
    tags: ["everyday"],
    level: "A1",
  },
  {
    id: "seed-vocab-tomorrow",
    en: "tomorrow",
    th: "พรุ่งนี้",
    pos: "adverb",
    transliteration: "phrung-nii",
    exampleSentenceIds: ["seed-sentence-0003"],
    tags: ["time"],
    level: "A1",
  },
];

export const SEED_SENTENCES: SeedSentence[] = [
  {
    id: "seed-sentence-0001",
    en: "Where are you going?",
    th: "คุณจะไปไหน",
    enAlternates: ["Where are you headed?"],
    thAlternates: ["คุณกำลังจะไปไหน"],
    transliteration: "khun ja pai nai",
    hint: "ไหน = where",
    notes: "Thai puts the question word at the end, where English fronts it.",
    tags: ["everyday", "questions"],
    level: "A1",
    lessonIds: ["seed-lesson-basics"],
    vocabIds: [],
  },
  {
    id: "seed-sentence-0002",
    en: "I am very hungry.",
    th: "ฉันหิวมาก",
    enAlternates: ["I'm very hungry."],
    thAlternates: [],
    transliteration: "chan hiu mak",
    hint: "มาก = very",
    notes: "Thai has no copula here: หิว behaves like a verb, so there is no word for 'am'.",
    tags: ["everyday"],
    level: "A1",
    lessonIds: ["seed-lesson-basics"],
    vocabIds: ["seed-vocab-hungry"],
  },
  {
    id: "seed-sentence-0003",
    en: "I will call you tomorrow.",
    th: "พรุ่งนี้ฉันจะโทรหาคุณ",
    enAlternates: ["I'll call you tomorrow."],
    thAlternates: ["ฉันจะโทรหาคุณพรุ่งนี้"],
    transliteration: "phrung-nii chan ja tho ha khun",
    hint: "จะ marks the future",
    notes: "Time expressions usually come first in Thai, but may also trail the clause.",
    tags: ["everyday", "time"],
    level: "A2",
    lessonIds: ["seed-lesson-basics"],
    vocabIds: ["seed-vocab-tomorrow"],
  },
];

export const SEED_LESSONS: SeedLesson[] = [
  {
    id: "seed-lesson-basics",
    title: "Everyday Basics",
    titleTh: "พื้นฐานประจำวัน",
    description: "A short starter set used to verify the seed loader.",
    tags: ["starter"],
    level: "A1",
    sentenceIds: SEED_SENTENCES.map((s) => s.id),
  },
];
