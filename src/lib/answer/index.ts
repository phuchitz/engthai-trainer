export { normalizeAnswer, normalizeEnglish, normalizeThai } from "./normalize";
export type { Language, NormalizeOptions } from "./normalize";

export { tokenize, tokenizeEnglish, tokenizeThai } from "./tokenize";

export { levenshtein, similarity } from "./distance";

export { alignWords, missingWords, extraWords, substitutedWords } from "./diff";
export type { AlignOp, Alignment } from "./diff";

export { accuracyFromAlignment, bandFor, BANDS, BAND_LABELS, BAND_THRESHOLDS } from "./score";
export type { Band } from "./score";

export { announceResult } from "./announce";
export type { AnnounceOptions } from "./announce";

export { checkAnswer } from "./check";
export type { CheckOptions, CheckResult } from "./check";
