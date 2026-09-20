import { z } from "zod";
import { idSchema, levelSchema, sourceSchema, tagsSchema, timestampSchema } from "./common";

export const sentenceSchema = z.object({
  id: idSchema,
  en: z.string().min(1).max(400),
  th: z.string().min(1).max(400),

  /**
   * Normalized forms used by the answer checker. Filled in by the normalization
   * pipeline in session 3; absent on rows written before it exists.
   */
  enNormalized: z.string().optional(),
  thNormalized: z.string().optional(),

  /** Additional answers that should also be accepted. */
  enAlternates: z.array(z.string().min(1).max(400)).default([]),
  thAlternates: z.array(z.string().min(1).max(400)).default([]),

  transliteration: z.string().max(400).optional(),
  hint: z.string().max(300).optional(),
  /** Grammar or usage note, shown after the answer is graded. */
  notes: z.string().max(1000).optional(),

  tags: tagsSchema.default([]),
  level: levelSchema,
  lessonIds: z.array(idSchema).default([]),
  vocabIds: z.array(idSchema).default([]),

  source: sourceSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export type Sentence = z.infer<typeof sentenceSchema>;

/** Shape accepted from seed files and imports, before ids and timestamps are assigned. */
export const sentenceInputSchema = sentenceSchema.partial({
  createdAt: true,
  updatedAt: true,
  source: true,
});

export type SentenceInput = z.input<typeof sentenceInputSchema>;
