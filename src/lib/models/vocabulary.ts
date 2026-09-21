import { z } from "zod";
import { idSchema, levelSchema, sourceSchema, tagsSchema, timestampSchema } from "./common";

export const PARTS_OF_SPEECH = [
  "noun",
  "verb",
  "adjective",
  "adverb",
  "pronoun",
  "preposition",
  "conjunction",
  "interjection",
  "phrase",
] as const;

export const partOfSpeechSchema = z.enum(PARTS_OF_SPEECH);
export type PartOfSpeech = z.infer<typeof partOfSpeechSchema>;

/** What a word means *in one particular sentence*, which is often not its headword sense. */
export const wordContextSchema = z.object({
  sentenceId: idSchema,
  meaning: z.string().min(1).max(300),
});

export type WordContext = z.infer<typeof wordContextSchema>;

export const vocabularyEntrySchema = z.object({
  id: idSchema,
  en: z.string().min(1).max(120),
  th: z.string().min(1).max(120),
  pos: partOfSpeechSchema.optional(),
  transliteration: z.string().max(120).optional(),
  /** Curated only. Absent means the panel shows no pronunciation, never a guess. */
  ipa: z.string().max(120).optional(),

  /**
   * Inflected surface forms that should resolve to this entry when tapped in a sentence,
   * e.g. "blockers" for "blocker". Curated: no stemming is attempted, because a wrong
   * stem would silently attach the wrong definition to a word.
   */
  forms: z.array(z.string().min(1).max(120)).default([]),

  /** Disambiguates homographs, e.g. "bank (river)" vs "bank (money)". */
  senseNote: z.string().max(200).optional(),

  contexts: z.array(wordContextSchema).default([]),

  /** A second sentence showing the word, distinct from the one being studied. */
  exampleEn: z.string().max(300).optional(),
  exampleTh: z.string().max(300).optional(),

  /** Set by the learner from the word panel. Curated entries start unsaved. */
  saved: z.boolean().default(false),

  exampleSentenceIds: z.array(idSchema).default([]),
  tags: tagsSchema.default([]),
  level: levelSchema,

  source: sourceSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export type VocabularyEntry = z.infer<typeof vocabularyEntrySchema>;

export const vocabularyEntryInputSchema = vocabularyEntrySchema.partial({
  createdAt: true,
  updatedAt: true,
  source: true,
});

export type VocabularyEntryInput = z.input<typeof vocabularyEntryInputSchema>;
