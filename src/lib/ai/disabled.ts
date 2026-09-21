import { aiFailure, type AIFailure, type AIProvider } from "./types";

export const NOT_CONFIGURED_MESSAGE =
  "AI is not configured. Everything in EngThai Trainer works without it — this feature is an optional extra.";

/**
 * The default provider: it does nothing, and says so kindly.
 *
 * This is what ships. Having a real implementation of the interface that refuses every
 * call — rather than a `null` provider callers must check for — means the AI paths are
 * exercised on every run, so no feature can quietly come to depend on AI being present.
 * Nothing leaves the device while this is in use.
 */
export const disabledProvider: AIProvider = {
  id: "none",
  label: "No AI provider",
  available: false,

  explainMistake: async () => notConfigured(),
  generateLesson: async () => notConfigured(),
  generateSentences: async () => notConfigured(),
  extractVocabulary: async () => notConfigured(),
  translate: async () => notConfigured(),
  generateBlankExercise: async () => notConfigured(),
  followUpQuestions: async () => notConfigured(),
};

function notConfigured(): AIFailure {
  return aiFailure("not-configured", NOT_CONFIGURED_MESSAGE);
}
