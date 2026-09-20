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

  durationMs: z.number().int().nonnegative().default(0),
  hintUsed: z.boolean().default(false),
  ttsUsed: z.boolean().default(false),

  createdAt: timestampSchema,
});

export type Attempt = z.infer<typeof attemptSchema>;
