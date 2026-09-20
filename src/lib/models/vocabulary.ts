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

export const vocabularyEntrySchema = z.object({
  id: idSchema,
  en: z.string().min(1).max(120),
  th: z.string().min(1).max(120),
  pos: partOfSpeechSchema.optional(),
  transliteration: z.string().max(120).optional(),

  /** Disambiguates homographs, e.g. "bank (river)" vs "bank (money)". */
  senseNote: z.string().max(200).optional(),

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
