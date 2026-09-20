import type { Language } from "./normalize";

let thaiSegmenter: Intl.Segmenter | null | undefined;

function getThaiSegmenter(): Intl.Segmenter | null {
  if (thaiSegmenter !== undefined) return thaiSegmenter;
  try {
    thaiSegmenter = new Intl.Segmenter("th", { granularity: "word" });
  } catch {
    thaiSegmenter = null;
  }
  return thaiSegmenter;
}

export function tokenizeEnglish(normalized: string): string[] {
  return normalized.length === 0 ? [] : normalized.split(" ").filter(Boolean);
}

/**
 * Thai is written without spaces between words, so tokens come from ICU word
 * segmentation. Where `Intl.Segmenter` is unavailable the whole run becomes a single
 * token, which still compares correctly — it just makes the word-level diff coarser.
 */
export function tokenizeThai(normalized: string): string[] {
  if (normalized.length === 0) return [];

  const segmenter = getThaiSegmenter();
  if (!segmenter) return normalized.split(" ").filter(Boolean);

  const tokens: string[] = [];
  for (const { segment, isWordLike } of segmenter.segment(normalized)) {
    if (isWordLike) tokens.push(segment);
  }
  return tokens;
}

export function tokenize(normalized: string, language: Language): string[] {
  return language === "th" ? tokenizeThai(normalized) : tokenizeEnglish(normalized);
}
