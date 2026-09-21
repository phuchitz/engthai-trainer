export {
  mistakeExplanationSchema,
  generatedSentenceSchema,
  generatedLessonSchema,
  extractedVocabularySchema,
  translationSchema,
  blankExerciseSchema,
  followUpQuestionsSchema,
  RESPONSE_SCHEMAS,
  CAPABILITIES,
} from "./schemas";
export type {
  Capability,
  MistakeExplanation,
  GeneratedSentence,
  GeneratedLesson,
  ExtractedVocabulary,
  Translation,
  BlankExercise,
  FollowUpQuestions,
} from "./schemas";

export { aiFailure, aiOk } from "./types";
export type {
  AIProvider,
  AIResult,
  AIFailure,
  AIFailureReason,
  AIRequest,
  AIResponse,
  ExplainMistakeRequest,
  GenerateLessonRequest,
  GenerateSentencesRequest,
  ExtractVocabularyRequest,
  TranslateRequest,
  BlankExerciseRequest,
  FollowUpRequest,
} from "./types";

export { disabledProvider, NOT_CONFIGURED_MESSAGE } from "./disabled";

export { validateResponse, extractJson } from "./validate";

export { describeRequest, checkConsent, NEVER_SENT } from "./consent";
export type { Disclosure, DisclosedField, ConsentState, ConsentCheck } from "./consent";

export { resolveProvider, listProviders, aiStatus, runCapability, NO_CONSENT_MESSAGE } from "./registry";
export type { AIStatus } from "./registry";
