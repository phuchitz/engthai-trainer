import type { Level, Category } from "@/lib/models";
import type {
  BlankExercise,
  Capability,
  ExtractedVocabulary,
  FollowUpQuestions,
  GeneratedLesson,
  GeneratedSentence,
  MistakeExplanation,
  Translation,
} from "./schemas";

/** Why a call produced nothing. Each maps to a message the learner can act on. */
export type AIFailureReason =
  "not-configured" | "no-consent" | "invalid-response" | "network" | "rate-limited" | "error";

export type AIFailure = {
  ok: false;
  reason: AIFailureReason;
  message: string;
  /** Validation problems, when the provider answered but the answer was unusable. */
  issues?: string[];
};

export type AIResult<T> = { ok: true; value: T } | AIFailure;

export function aiFailure(reason: AIFailureReason, message: string, issues?: string[]): AIFailure {
  return { ok: false, reason, message, ...(issues ? { issues } : {}) };
}

export function aiOk<T>(value: T): AIResult<T> {
  return { ok: true, value };
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export type ExplainMistakeRequest = {
  english: string;
  thai: string;
  learnerAnswer: string;
  expectedAnswer: string;
};

export type GenerateLessonRequest = {
  topic: string;
  category: Category;
  level: Level;
  count: number;
};

export type GenerateSentencesRequest = {
  level: Level;
  count: number;
  topic?: string;
};

export type ExtractVocabularyRequest = {
  english: string;
  thai: string;
};

export type TranslateRequest = {
  english: string;
  /** Existing sentences that set the register to match, if any. */
  context?: string[];
};

export type BlankExerciseRequest = {
  english: string;
  blanks: number;
};

export type FollowUpRequest = {
  english: string;
  thai: string;
  level: Level;
};

export type AIRequest = {
  explainMistake: ExplainMistakeRequest;
  generateLesson: GenerateLessonRequest;
  generateSentences: GenerateSentencesRequest;
  extractVocabulary: ExtractVocabularyRequest;
  translate: TranslateRequest;
  generateBlankExercise: BlankExerciseRequest;
  followUpQuestions: FollowUpRequest;
};

export type AIResponse = {
  explainMistake: MistakeExplanation;
  generateLesson: GeneratedLesson;
  generateSentences: GeneratedSentence[];
  extractVocabulary: ExtractedVocabulary[];
  translate: Translation;
  generateBlankExercise: BlankExercise;
  followUpQuestions: FollowUpQuestions;
};

/**
 * Everything an AI provider can be asked to do.
 *
 * Deliberately uniform: every method takes a typed request and returns an `AIResult`
 * rather than throwing. A provider that is missing, offline, rate-limited or talking
 * nonsense all surface the same way, so callers have exactly one path to handle and no
 * feature can be written that only works when AI happens to be present.
 */
export interface AIProvider {
  readonly id: string;
  readonly label: string;
  /** False for the default no-op provider. Nothing leaves the device while it is false. */
  readonly available: boolean;

  explainMistake(request: ExplainMistakeRequest): Promise<AIResult<MistakeExplanation>>;
  generateLesson(request: GenerateLessonRequest): Promise<AIResult<GeneratedLesson>>;
  generateSentences(request: GenerateSentencesRequest): Promise<AIResult<GeneratedSentence[]>>;
  extractVocabulary(request: ExtractVocabularyRequest): Promise<AIResult<ExtractedVocabulary[]>>;
  translate(request: TranslateRequest): Promise<AIResult<Translation>>;
  generateBlankExercise(request: BlankExerciseRequest): Promise<AIResult<BlankExercise>>;
  followUpQuestions(request: FollowUpRequest): Promise<AIResult<FollowUpQuestions>>;
}

export type { Capability };
