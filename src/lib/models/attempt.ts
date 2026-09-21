import { z } from "zod";
import {
  directionSchema,
  exerciseModeSchema,
  gradeSchema,
  idSchema,
  itemTypeSchema,
  timestampSchema,
  verdictSchema,
} from "./common";

/**
 * One graded answer. Append-only and never mutated: every dashboard figure is
 * recomputed from this log rather than read from a stored counter.
 */
export const attemptSchema = z.object({
  id: idSchema,
  sessionId: idSchema,
  progressId: z.string().min(3).max(200),
  itemType: itemTypeSchema,
  itemId: idSchema,
  direction: directionSchema,
  mode: exerciseModeSchema,

  prompt: z.string().max(400),
  userAnswer: z.string().max(400),
  expectedAnswer: z.string().max(400),

  verdict: verdictSchema,
  grade: gradeSchema,
  /** 0–1 similarity reported by the answer checker. */
  similarity: z.number().min(0).max(1).default(0),

  /**
   * **Active** time on this card: background and idle stretches excluded.
   * See lib/gamification/studyTime.ts for exactly what counts.
   */
  durationMs: z.number().int().nonnegative().default(0),

  /**
   * XP actually paid for this attempt, recorded rather than recomputed.
   *
   * The award depends on the grading band and on whether the card had already been
   * passed today, and the stored verdict cannot distinguish a "great" from a "good".
   * Writing down what happened keeps the running total exact.
   */
  xpAwarded: z.number().int().nonnegative().default(0),
  hintUsed: z.boolean().default(false),
  ttsUsed: z.boolean().default(false),

  createdAt: timestampSchema,
});

export type Attempt = z.infer<typeof attemptSchema>;
