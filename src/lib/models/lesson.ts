import { z } from "zod";
import { idSchema, levelSchema, sourceSchema, tagsSchema, timestampSchema } from "./common";

export const lessonSchema = z.object({
  id: idSchema,
  title: z.string().min(1).max(120),
  titleTh: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  tags: tagsSchema.default([]),
  level: levelSchema,
  /** Ordered: lesson order is meaningful, so this is the sequence learners see. */
  sentenceIds: z.array(idSchema).default([]),
  source: sourceSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export type Lesson = z.infer<typeof lessonSchema>;
