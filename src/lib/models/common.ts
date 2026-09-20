import { z } from "zod";

export const LEVELS = ["A1", "A2", "B1", "B2", "C1"] as const;
export const DIRECTIONS = ["en2th", "th2en"] as const;
export const ITEM_TYPES = ["sentence", "vocab"] as const;
export const SOURCES = ["builtin", "user", "imported"] as const;
export const EXERCISE_MODES = [
  "translate",
  "dictation",
  "wordOrder",
  "fillBlank",
  "multipleChoice",
  "speak",
] as const;
export const VERDICTS = ["correct", "close", "incorrect", "skipped", "revealed"] as const;
/** Learner-facing progress bands, distinct from the scheduler's internal state. */
export const MEMORY_LEVELS = ["new", "learning", "familiar", "known", "mastered"] as const;
export const SRS_STATES = ["new", "learning", "review", "relearning"] as const;
export const SESSION_KINDS = ["lesson", "review", "mixed"] as const;

export const levelSchema = z.enum(LEVELS);
export const directionSchema = z.enum(DIRECTIONS);
export const itemTypeSchema = z.enum(ITEM_TYPES);
export const sourceSchema = z.enum(SOURCES);
export const exerciseModeSchema = z.enum(EXERCISE_MODES);
export const verdictSchema = z.enum(VERDICTS);
export const memoryLevelSchema = z.enum(MEMORY_LEVELS);
export const srsStateSchema = z.enum(SRS_STATES);
export const sessionKindSchema = z.enum(SESSION_KINDS);

export type Level = z.infer<typeof levelSchema>;
export type Direction = z.infer<typeof directionSchema>;
export type ItemType = z.infer<typeof itemTypeSchema>;
export type Source = z.infer<typeof sourceSchema>;
export type ExerciseMode = z.infer<typeof exerciseModeSchema>;
export type Verdict = z.infer<typeof verdictSchema>;
export type MemoryLevel = z.infer<typeof memoryLevelSchema>;
export type SrsState = z.infer<typeof srsStateSchema>;
export type SessionKind = z.infer<typeof sessionKindSchema>;

/**
 * Ids are generated as ULIDs, but seed decks and imported files bring their own,
 * so the schema only requires a non-empty, reasonably short string.
 */
export const idSchema = z.string().min(1).max(64);

/** Epoch milliseconds. Numbers index and range-query cleanly in IndexedDB. */
export const timestampSchema = z.number().int().nonnegative();

/** Grades follow the FSRS rating scale: 1 Again, 2 Hard, 3 Good, 4 Easy. */
export const gradeSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);
export type Grade = z.infer<typeof gradeSchema>;

export const tagsSchema = z.array(z.string().min(1).max(40));

/** ISO calendar day in the learner's local timezone, e.g. "2026-09-20". */
export const localDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
