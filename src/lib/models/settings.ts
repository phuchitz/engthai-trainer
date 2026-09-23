import { z } from "zod";
import { localDateSchema, timestampSchema } from "./common";

export const STRICTNESS_LEVELS = ["lenient", "normal", "strict"] as const;
export const strictnessSchema = z.enum(STRICTNESS_LEVELS);
export type Strictness = z.infer<typeof strictnessSchema>;

export const AI_PROVIDERS = ["none", "anthropic", "openai"] as const;
export const aiProviderSchema = z.enum(AI_PROVIDERS);

export const SETTINGS_ID = "singleton";

export const settingsSchema = z.object({
  id: z.literal(SETTINGS_ID),

  dailyGoal: z.number().int().min(1).max(500).default(20),
  newPerDay: z.number().int().min(0).max(200).default(10),
  maxReviewsPerDay: z.number().int().min(0).max(1000).default(120),

  /**
   * Applies to the English side only. Typed Thai is always checked strictly,
   * because tone marks and vowel signs change the word.
   */
  strictness: strictnessSchema.default("normal"),
  ignoreCase: z.boolean().default(true),
  ignorePunctuation: z.boolean().default(true),

  ttsEnabled: z.boolean().default(true),
  ttsVoiceEn: z.string().max(120).nullable().default(null),
  ttsVoiceTh: z.string().max(120).nullable().default(null),
  ttsRate: z.number().min(0.5).max(2).default(1),
  /** Speech recognition is self-assessed: it never marks an answer wrong on its own. */
  sttEnabled: z.boolean().default(false),

  /** Short feedback tones after grading. Off by default: sound is an interruption. */
  /**
   * On by default: the tone after a correct answer is the clearest signal the app gives
   * that something went right, and a learner who dislikes it turns it off once.
   */
  soundEnabled: z.boolean().default(true),


  /**
   * Optional AI, off by default.
   *
   * There is deliberately **no credential field here**. Settings are persisted to
   * IndexedDB and included in every backup file, so a key stored here would be written
   * to disk in plain text and copied into every export. A credentialed provider must
   * live behind a server-side adapter that holds its own secret — see docs/ai.md.
   *
   * `consentGivenAt` records when the learner explicitly agreed to send learning content
   * to a provider. Null means no consent, which is the default and blocks every call.
   */
  ai: z
    .object({
      enabled: z.boolean().default(false),
      provider: aiProviderSchema.default("none"),
      model: z.string().max(120).nullable().default(null),
      consentGivenAt: timestampSchema.nullable().default(null),
    })
    .default({ enabled: false, provider: "none", model: null, consentGivenAt: null }),

  streak: z
    .object({
      current: z.number().int().nonnegative().default(0),
      longest: z.number().int().nonnegative().default(0),
      lastStudyDate: localDateSchema.nullable().default(null),
      freezesRemaining: z.number().int().nonnegative().default(0),
    })
    .default({ current: 0, longest: 0, lastStudyDate: null, freezesRemaining: 0 }),

  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export type Settings = z.infer<typeof settingsSchema>;

/**
 * Theme is deliberately absent: it must be readable synchronously before first paint
 * to avoid a flash, so it lives in localStorage rather than IndexedDB.
 */
export function defaultSettings(now: number): Settings {
  return settingsSchema.parse({ id: SETTINGS_ID, createdAt: now, updatedAt: now });
}
