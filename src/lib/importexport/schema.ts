import { z } from "zod";
import { categorySchema, levelSchema } from "@/lib/models";

/**
 * The shape a lesson import may take, whatever format it arrived in.
 *
 * Required: `english`, `thai`. Everything else is optional, and the defaults below are
 * the contract — see docs/import-export.md.
 *
 * | Field                | Default    | Notes                                        |
 * | -------------------- | ---------- | -------------------------------------------- |
 * | `level`              | `A1`       | One of A1, A2, B1, B2, C1                    |
 * | `category`           | `custom`   | Imported material is yours until you move it |
 * | `acceptedAnswers`    | `[]`       | Extra English answers that also count        |
 * | `vocabulary`         | `[]`       | Needs an English *and* a Thai side           |
 * | `grammarExplanation` | *none*     | Shown after grading                          |
 * | `examples`           | *none*     | Only the first is stored                     |
 */

export const IMPORT_DEFAULT_LEVEL = "A1" as const;
export const IMPORT_DEFAULT_CATEGORY = "custom" as const;

/**
 * A vocabulary item must carry both sides.
 *
 * A bare English word is rejected rather than stored with a blank meaning: the word
 * panel shows only hand-written data, and a half-empty entry would be worse than none.
 */
export const importVocabularySchema = z.object({
  en: z.string().trim().min(1).max(120),
  th: z.string().trim().min(1).max(120),
});

export const importExampleSchema = z.object({
  en: z.string().trim().min(1).max(300),
  th: z.string().trim().max(300).optional(),
});

export const lessonImportRowSchema = z.object({
  english: z.string().trim().min(1, "english is required").max(400),
  thai: z.string().trim().min(1, "thai is required").max(400),

  level: levelSchema.default(IMPORT_DEFAULT_LEVEL),
  category: categorySchema.default(IMPORT_DEFAULT_CATEGORY),

  acceptedAnswers: z.array(z.string().trim().min(1).max(400)).default([]),
  vocabulary: z.array(importVocabularySchema).default([]),
  grammarExplanation: z.string().trim().max(1000).optional(),
  examples: z.array(importExampleSchema).default([]),

  transliteration: z.string().trim().max(400).optional(),
  hint: z.string().trim().max(300).optional(),
});

export type LessonImportRow = z.infer<typeof lessonImportRowSchema>;
export type LessonImportInput = z.input<typeof lessonImportRowSchema>;

/** Accepts either a bare array or `{ sentences: [...] }`, which is what an export looks like. */
export const lessonImportFileSchema = z.union([
  z.array(z.unknown()),
  z.object({ sentences: z.array(z.unknown()) }).transform((value) => value.sentences),
  z.object({ rows: z.array(z.unknown()) }).transform((value) => value.rows),
]);
