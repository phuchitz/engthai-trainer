import { z } from "zod";
import { categorySchema, levelSchema } from "@/lib/models";

/**
 * Shapes for everything an AI provider may return.
 *
 * A model's output is **untrusted input**, no different from a pasted file: it can be
 * truncated, wrapped in prose, or confidently wrong about its own shape. Nothing reaches
 * the database or the screen without passing one of these first.
 *
 * Note what is deliberately absent: no schema here lets a provider supply an IPA
 * pronunciation or a curated word entry. The word panel shows hand-written data only,
 * and a generated pronunciation would quietly break that promise.
 */

const shortText = z.string().trim().min(1).max(400);
const longText = z.string().trim().min(1).max(2000);

export const mistakeExplanationSchema = z.object({
  /** Written in Thai: the learner is a Thai speaker being told why they slipped. */
  explanationTh: longText,
  /** The specific rule at issue, if the model identified one. */
  ruleTh: z.string().trim().max(300).optional(),
  corrected: shortText,
  examples: z
    .array(z.object({ en: shortText, th: shortText }))
    .max(3)
    .default([]),
});
export type MistakeExplanation = z.infer<typeof mistakeExplanationSchema>;

export const generatedSentenceSchema = z.object({
  english: shortText,
  thai: shortText,
  level: levelSchema,
  acceptedAnswers: z.array(shortText).max(5).default([]),
  grammarExplanationTh: z.string().trim().max(1000).optional(),
});
export type GeneratedSentence = z.infer<typeof generatedSentenceSchema>;

export const generatedLessonSchema = z.object({
  title: z.string().trim().min(1).max(120),
  titleTh: z.string().trim().min(1).max(120),
  category: categorySchema,
  level: levelSchema,
  sentences: z.array(generatedSentenceSchema).min(1).max(50),
});
export type GeneratedLesson = z.infer<typeof generatedLessonSchema>;

export const extractedVocabularySchema = z.object({
  en: z.string().trim().min(1).max(120),
  th: z.string().trim().min(1).max(120),
  /** Why this word means this *here*, which is the part a dictionary cannot give. */
  contextTh: z.string().trim().max(300).optional(),
});
export type ExtractedVocabulary = z.infer<typeof extractedVocabularySchema>;

export const translationSchema = z.object({
  thai: shortText,
  /** Alternative renderings the model considers equally natural. */
  alternatives: z.array(shortText).max(5).default([]),
  noteTh: z.string().trim().max(500).optional(),
});
export type Translation = z.infer<typeof translationSchema>;

export const blankExerciseSchema = z.object({
  /** The sentence with each gap written as `____`. */
  masked: shortText,
  answers: z.array(z.string().trim().min(1).max(120)).min(1).max(5),
  hintTh: z.string().trim().max(300).optional(),
});
export type BlankExercise = z.infer<typeof blankExerciseSchema>;

export const followUpQuestionsSchema = z.object({
  questions: z
    .array(z.object({ en: shortText, th: shortText.optional() }))
    .min(1)
    .max(5),
});
export type FollowUpQuestions = z.infer<typeof followUpQuestionsSchema>;

/** Every capability, paired with the schema its result must satisfy. */
export const RESPONSE_SCHEMAS = {
  explainMistake: mistakeExplanationSchema,
  generateLesson: generatedLessonSchema,
  generateSentences: z.array(generatedSentenceSchema).min(1).max(50),
  extractVocabulary: z.array(extractedVocabularySchema).max(30),
  translate: translationSchema,
  generateBlankExercise: blankExerciseSchema,
  followUpQuestions: followUpQuestionsSchema,
} as const;

export type Capability = keyof typeof RESPONSE_SCHEMAS;

export const CAPABILITIES = Object.keys(RESPONSE_SCHEMAS) as Capability[];
