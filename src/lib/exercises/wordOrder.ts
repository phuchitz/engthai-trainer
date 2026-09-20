import { normalizeAnswer, tokenize, type Language } from "@/lib/answer";
import { createRandom, seedFrom, shuffle } from "./random";

/**
 * A tile the learner taps.
 *
 * Identity is the index, not the text, so a sentence containing the same word twice
 * yields two distinct tiles. Keying by text would make the two interchangeable: tapping
 * one would consume the other, and removing a tile would remove the wrong one.
 */
export type Token = {
  id: string;
  text: string;
  /** Position in the correct answer. Used only for grading feedback, never shown. */
  index: number;
};

export type WordOrderPuzzle = {
  language: Language;
  /** Tiles in the order presented to the learner. */
  tiles: Token[];
  /** The tokens in their correct order. */
  solution: Token[];
};

export function buildTokens(text: string, language: Language): Token[] {
  const normalized = normalizeAnswer(text, language);
  return tokenize(normalized, language).map((word, index) => ({
    id: `${index}`,
    text: word,
    index,
  }));
}

/**
 * Thai is written without spaces between words, so its tiles join directly; English
 * joins with a space. Either way the result is fed through the same answer checker as
 * a typed answer, so the two paths cannot drift apart.
 */
export function joinTokens(tokens: readonly Token[], language: Language): string {
  return tokens.map((t) => t.text).join(language === "th" ? "" : " ");
}

export function createWordOrderPuzzle(text: string, language: Language, seed?: number): WordOrderPuzzle {
  const solution = buildTokens(text, language);
  const random = createRandom(seed ?? seedFrom(text));

  let tiles = shuffle(solution, random);
  // A shuffle that lands back on the original order is not a puzzle. Only retry when a
  // different arrangement is actually possible.
  if (solution.length > 1 && hasDistinctArrangement(solution)) {
    let attempts = 0;
    while (isSameOrder(tiles, solution) && attempts < 10) {
      tiles = shuffle(solution, random);
      attempts += 1;
    }
    if (isSameOrder(tiles, solution)) tiles = rotate(solution);
  }

  return { language, tiles, solution };
}

function isSameOrder(a: readonly Token[], b: readonly Token[]): boolean {
  return a.every((token, i) => token.text === b[i].text);
}

/** False when every token is the same word, where no shuffle can look different. */
function hasDistinctArrangement(tokens: readonly Token[]): boolean {
  return new Set(tokens.map((t) => t.text)).size > 1;
}

function rotate(tokens: readonly Token[]): Token[] {
  return [...tokens.slice(1), tokens[0]];
}

/** Tiles not yet placed, preserving the presented order. */
export function remainingTiles(puzzle: WordOrderPuzzle, placed: readonly Token[]): Token[] {
  const used = new Set(placed.map((t) => t.id));
  return puzzle.tiles.filter((tile) => !used.has(tile.id));
}

export function isComplete(puzzle: WordOrderPuzzle, placed: readonly Token[]): boolean {
  return placed.length === puzzle.solution.length;
}
