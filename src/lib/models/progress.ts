import { z } from "zod";
import {
  EXERCISE_MODES,
  directionSchema,
  idSchema,
  itemTypeSchema,
  memoryLevelSchema,
  srsStateSchema,
  timestampSchema,
} from "./common";

/** One counter per exercise mode, so the UI can say *how* an item is being failed. */
export const mistakesByModeSchema = z.object(
  Object.fromEntries(EXERCISE_MODES.map((mode) => [mode, z.number().int().nonnegative().default(0)])) as {
    [K in (typeof EXERCISE_MODES)[number]]: z.ZodDefault<z.ZodNumber>;
  },
);

export type MistakesByMode = z.infer<typeof mistakesByModeSchema>;

export function emptyMistakesByMode(): MistakesByMode {
  return Object.fromEntries(EXERCISE_MODES.map((mode) => [mode, 0])) as MistakesByMode;
}

/**
 * Scheduling state for one item in one direction. Recognising EN→TH and producing
 * TH→EN are different skills, so each direction gets its own row and its own schedule.
 */
export const sentenceProgressSchema = z.object({
  /** `${itemType}:${itemId}:${direction}` — deterministic, so re-imports merge. */
  id: z.string().min(3).max(200),
  itemType: itemTypeSchema,
  itemId: idSchema,
  direction: directionSchema,

  practiceCount: z.number().int().nonnegative().default(0),
  correctCount: z.number().int().nonnegative().default(0),
  incorrectCount: z.number().int().nonnegative().default(0),
  consecutiveSuccesses: z.number().int().nonnegative().default(0),

  lastPracticedAt: timestampSchema.nullable().default(null),
  nextReviewAt: timestampSchema,

  memoryLevel: memoryLevelSchema.default("new"),
  state: srsStateSchema.default("new"),

  /** FSRS memory stability, in days. */
  stability: z.number().nonnegative().default(0),
  /** FSRS difficulty, 1–10. */
  difficulty: z.number().min(1).max(10).default(5),
  /** SM-2 style ease factor, retained for display and for the SM-2 fallback scheduler. */
  ease: z.number().min(1.3).max(3.5).default(2.5),
  /** Current scheduling interval in days. */
  intervalDays: z.number().nonnegative().default(0),

  reps: z.number().int().nonnegative().default(0),
  lapses: z.number().int().nonnegative().default(0),

  mistakesByMode: mistakesByModeSchema.default(emptyMistakesByMode()),

  /** Incremented on repeated lapses; a leech gets surfaced for editing or suspension. */
  leechCount: z.number().int().nonnegative().default(0),
  suspended: z.boolean().default(false),

  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export type SentenceProgress = z.infer<typeof sentenceProgressSchema>;
