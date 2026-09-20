import { normalizeAnswer, type Language, type NormalizeOptions } from "./normalize";
import { tokenize } from "./tokenize";
import { alignWords, extraWords, missingWords, substitutedWords, type AlignOp, type Alignment } from "./diff";
import { accuracyFromAlignment, bandFor, type Band } from "./score";

export type CheckOptions = NormalizeOptions & {
  language: Language;
  /** Extra answers the author marked acceptable. Never reported as wrong. */
  alternatives?: string[];
};

export type CheckResult = {
  /** True only on an exact normalized match against the expected answer or an alternative. */
  correct: boolean;
  accuracy: number;
  band: Band;
  /** The accepted answer the learner came closest to, in its original form. */
  matchedAnswer: string;
  /** True when `matchedAnswer` is an authored alternative rather than the primary answer. */
  matchedAlternative: boolean;
  normalizedUser: string;
  normalizedExpected: string;
  expectedTokens: string[];
  receivedTokens: string[];
  ops: AlignOp[];
  missing: string[];
  extra: string[];
  substituted: { expected: string; received: string }[];
};

type Candidate = {
  original: string;
  normalized: string;
  tokens: string[];
  isAlternative: boolean;
};

/**
 * Grades a typed answer against the expected answer and any authored alternatives.
 *
 * Every accepted answer is scored and the best one wins, so an alternative can never be
 * reported as wrong — the learner is always graded against whichever wording they were
 * actually aiming at.
 *
 * Thai is graded strictly. English tolerance (case, punctuation, near-miss spelling)
 * exists because those differences do not change the sentence; in Thai a tone mark or a
 * vowel sign is a different word, so anything short of an exact match after Unicode
 * normalization is "Try Again" however close it looked. The accuracy figure is still
 * reported, so the learner can see how near they were without the miss being accepted.
 */
export function checkAnswer(userAnswer: string, expected: string, options: CheckOptions): CheckResult {
  const { language, alternatives = [], ...normalizeOptions } = options;

  const normalizedUser = normalizeAnswer(userAnswer, language, normalizeOptions);
  const receivedTokens = tokenize(normalizedUser, language);

  const candidates: Candidate[] = [expected, ...alternatives].map((original, index) => {
    const normalized = normalizeAnswer(original, language, normalizeOptions);
    return { original, normalized, tokens: tokenize(normalized, language), isAlternative: index > 0 };
  });

  let best: { candidate: Candidate; alignment: Alignment; accuracy: number } | null = null;

  for (const candidate of candidates) {
    const alignment = alignWords(candidate.tokens, receivedTokens);
    const accuracy = accuracyFromAlignment(alignment, candidate.tokens.length, receivedTokens.length);
    if (!best || accuracy > best.accuracy) best = { candidate, alignment, accuracy };
    if (accuracy === 100) break;
  }

  // `expected` always produces at least one candidate, so `best` is set by here.
  const { candidate, alignment, accuracy } = best!;

  const correct = alignment.cost === 0 && receivedTokens.length > 0;
  const band = language === "th" && !correct ? "tryAgain" : bandFor(accuracy);

  return {
    correct,
    accuracy,
    band,
    matchedAnswer: candidate.original,
    matchedAlternative: candidate.isAlternative,
    normalizedUser,
    normalizedExpected: candidate.normalized,
    expectedTokens: candidate.tokens,
    receivedTokens,
    ops: alignment.ops,
    missing: missingWords(alignment),
    extra: extraWords(alignment),
    substituted: substitutedWords(alignment),
  };
}
