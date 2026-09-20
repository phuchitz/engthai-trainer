export type Language = "en" | "th";

export type NormalizeOptions = {
  /** English only. Thai has no letter case. */
  ignoreCase?: boolean;
  /** English only. Thai punctuation is not used to end sentences. */
  ignorePunctuation?: boolean;
};

/** Curly quotes, primes and the modifier letter apostrophe all mean the same thing here. */
const APOSTROPHES = /[‘’‛ʼʹ′´`]/g;
const DASHES = /[‐‑‒–—―−]/g;

/** Zero-width joiners and the BOM survive copy-paste and would otherwise break equality. */
const INVISIBLE = /[​‌‍⁠﻿]/g;

const WHITESPACE = /\s+/g;

/**
 * Punctuation that carries no meaning for a sentence-translation answer. An apostrophe
 * and a hyphen are deliberately excluded here and handled positionally below, because
 * they are meaningful inside a word ("don't", "well-known") but not around one.
 */
function stripPunctuation(text: string): string {
  return text.replace(/[\p{P}\p{S}]/gu, (char) => (char === "'" || char === "-" ? char : " "));
}

/**
 * Drops apostrophes and hyphens that are not flanked by letters or digits on both sides,
 * which removes quote marks and stray dashes while leaving contractions intact.
 */
function stripEdgeMarks(text: string): string {
  return text.replace(/(?<![\p{L}\p{N}])['-]+|['-]+(?![\p{L}\p{N}])/gu, " ");
}

export function normalizeEnglish(text: string, options: NormalizeOptions = {}): string {
  const { ignoreCase = true, ignorePunctuation = true } = options;

  let result = text.normalize("NFC").replace(INVISIBLE, "").replace(APOSTROPHES, "'").replace(DASHES, "-");

  if (ignoreCase) result = result.toLowerCase();

  if (ignorePunctuation) {
    result = stripEdgeMarks(stripPunctuation(result));
  }

  return result.replace(WHITESPACE, " ").trim();
}

/**
 * Thai normalization is deliberately minimal.
 *
 * Only Unicode composition, invisible characters and whitespace are touched. Tone marks
 * and vowel signs are never stripped: they are combining characters that change the word,
 * so folding them away would silently accept a different word as correct.
 */
export function normalizeThai(text: string): string {
  return text.normalize("NFC").replace(INVISIBLE, "").replace(WHITESPACE, " ").trim();
}

export function normalizeAnswer(text: string, language: Language, options: NormalizeOptions = {}): string {
  return language === "th" ? normalizeThai(text) : normalizeEnglish(text, options);
}
