import { normalizeEnglish, tokenizeEnglish } from "@/lib/answer";
import { createRandom, seedFrom, shuffle } from "./random";

/**
 * One option on screen.
 *
 * Identity is the position in the presented list, not the text — the same rule the
 * Sentence Builder tiles follow. Options are deduplicated by normalized text, so two
 * cannot read alike, and keying by position keeps selection unambiguous regardless.
 */
export type Choice = {
  id: string;
  text: string;
  correct: boolean;
};

export type MultipleChoicePuzzle = {
  options: Choice[];
  /** Position of the correct option, for grading feedback. Never shown before grading. */
  answerIndex: number;
};

export const OPTION_COUNT = 4;

/** Below this a question is not a question, so no puzzle is produced at all. */
export const MIN_OPTIONS = 3;

const wordCount = (text: string) => tokenizeEnglish(normalizeEnglish(text)).length;

/**
 * Builds a multiple-choice question from real sentences.
 *
 * **Distractors are other sentences the learner owns, never invented text.** The same
 * rule the word panel follows: this app does not generate language.
 *
 * They are chosen by closeness in length to the answer, because a correct sentence that
 * is visibly longer or shorter than every alternative can be picked without reading Thai
 * at all. Ties are broken by a seeded shuffle rather than by pool order, so the
 * distractors are not always the same few sentences.
 *
 * Returns `null` when the pool cannot supply enough distinct options. A question with
 * one plausible answer teaches nothing, and inventing a wrong answer to pad it out is
 * exactly what this app refuses to do elsewhere.
 */
export function createMultipleChoicePuzzle(
  answer: string,
  pool: readonly string[],
  seed?: number,
): MultipleChoicePuzzle | null {
  const answerKey = normalizeEnglish(answer);
  if (answerKey.length === 0) return null;

  const random = createRandom(seed ?? seedFrom(answer));

  const seen = new Set([answerKey]);
  const candidates: string[] = [];
  for (const text of pool) {
    const key = normalizeEnglish(text);
    if (key.length === 0 || seen.has(key)) continue;
    seen.add(key);
    candidates.push(text);
  }

  const target = wordCount(answer);
  const distractors = shuffle(candidates, random)
    .map((text, index) => ({ text, index, distance: Math.abs(wordCount(text) - target) }))
    // The shuffle above is the tie-break: a stable sort keeps its order within a distance.
    .sort((a, b) => a.distance - b.distance || a.index - b.index)
    .slice(0, OPTION_COUNT - 1)
    .map((entry) => entry.text);

  if (distractors.length + 1 < MIN_OPTIONS) return null;

  const options = shuffle(
    [{ text: answer, correct: true }, ...distractors.map((text) => ({ text, correct: false }))],
    random,
  ).map((option, index) => ({ id: `${index}`, ...option }));

  return { options, answerIndex: options.findIndex((option) => option.correct) };
}

/** The text of the option at `index`, or an empty answer when nothing is selected. */
export function chosenText(puzzle: MultipleChoicePuzzle, index: number | null): string {
  if (index === null) return "";
  return puzzle.options[index]?.text ?? "";
}

export function isCorrectChoice(puzzle: MultipleChoicePuzzle, index: number | null): boolean {
  return index !== null && index === puzzle.answerIndex;
}
