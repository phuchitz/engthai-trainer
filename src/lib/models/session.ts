import { z } from "zod";
import { idSchema, sessionKindSchema, timestampSchema } from "./common";

export const studySessionSchema = z.object({
  id: idSchema,
  kind: sessionKindSchema,
  lessonId: idSchema.nullable().default(null),

  startedAt: timestampSchema,
  endedAt: timestampSchema.nullable().default(null),

  plannedCount: z.number().int().nonnegative().default(0),
  completedCount: z.number().int().nonnegative().default(0),
  correctCount: z.number().int().nonnegative().default(0),
  xpEarned: z.number().int().nonnegative().default(0),
  durationMs: z.number().int().nonnegative().default(0),
});

export type StudySession = z.infer<typeof studySessionSchema>;
