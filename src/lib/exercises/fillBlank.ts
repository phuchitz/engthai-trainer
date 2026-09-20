import { normalizeAnswer, tokenize, type Language } from "@/lib/answer";
import { createRandom, seedFrom, shuffle } from "./random";

/** Grammatical words make poor blanks: guessing "the" teaches nothing. */
const FUNCTION_WORDS = new Set([
  "a",
  "an",
  "the",
  "is",
  "am",
  "are",
  "was",
  "were",
  "be",
  "been",
  "to",
  "of",
  "in",
  "on",
  "at",
  "for",
  "and",
  "or",
  "but",
  "i",
  "you",
  "he",
  "she",
  "it",
  "we",
  "they",
  "my",
  "your",
  "do",
  "does",
  "did",
  "not",
  "so",
]);

export type Blank = {
  /** Position of the removed word in the token list. */
  index: number;
  answer: string;
};

export type FillBlankPuzzle = {
  language: Language;
  /** Every token of the sentence, in order. */
  tokens: string[];
  blanks: Blank[];
};

export const MAX_BLANKS = 3;

/** Roughly one blank per four words, so a short sentence keeps enough context to be solvable. */
export function blankCountFor(tokenCount: number): number {
  if (tokenCount <= 1) return tokenCount;
  return Math.min(MAX_BLANKS, Math.max(1, Math.round(tokenCount / 4)));
}

export function createFillBlankPuzzle(text: string, language: Language, seed?: number): FillBlankPuzzle {
  const tokens = tokenize(normalizeAnswer(text, language), language);
  const count = blankCountFor(tokens.length);

  if (count === 0) return { language, tokens, blanks: [] };

  const random = createRandom(seed ?? seedFrom(text));

  // Prefer content words, but fall back to everything rather than produce no blank at
  // all — a sentence made entirely of function words still has to be answerable.
  const contentIndexes = tokens
    .map((token, index) => ({ token, index }))
    .filter(({ token }) => !FUNCTION_WORDS.has(token))
    .map(({ index }) => index);
  const pool = contentIndexes.length >= count ? contentIndexes : tokens.map((_, index) => index);

  const chosen = shuffle(pool, random)
    .slice(0, count)
    .sort((a, b) => a - b);

  return {
    language,
    tokens,
    blanks: chosen.map((index) => ({ index, answer: tokens[index] })),
  };
}

/** The sentence with each blank replaced by a marker, for display. */
export function maskedTokens(puzzle: FillBlankPuzzle, placeholder = "____"): string[] {
  const blanked = new Set(puzzle.blanks.map((b) => b.index));
  return puzzle.tokens.map((token, index) => (blanked.has(index) ? placeholder : token));
}

export type BlankScoring = {
  expected: string;
  received: string;
};

/**
 * Scores **only the removed words**, not the whole sentence.
 *
 * Grading the reassembled sentence would flatter the learner: the words that were never
 * removed are always right, so a two-blank puzzle in a ten-word sentence would score 80%
 * with both blanks wrong. Comparing just the blanks makes one of two correct read as 50%.
 *
 * Missing entries are kept as empty strings rather than dropped, so an unanswered blank
 * stays aligned with the one it belongs to instead of shifting the rest along.
 */
export function scoreBlanks(puzzle: FillBlankPuzzle, answers: readonly string[]): BlankScoring {
  return {
    expected: puzzle.blanks.map((blank) => blank.answer).join(" "),
    received: puzzle.blanks.map((_, i) => (answers[i] ?? "").trim()).join(" "),
  };
}

/** The learner's answers written back into the sentence, for the review panel. */
export function fillIn(puzzle: FillBlankPuzzle, answers: readonly string[]): string {
  const byIndex = new Map(puzzle.blanks.map((blank, i) => [blank.index, (answers[i] ?? "").trim()]));
  const tokens = puzzle.tokens.map((token, index) =>
    byIndex.has(index) ? byIndex.get(index) || "____" : token,
  );
  return tokens.join(puzzle.language === "th" ? "" : " ");
}
