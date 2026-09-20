import type { Alignment } from "./diff";

export const BANDS = ["perfect", "great", "good", "tryAgain"] as const;
export type Band = (typeof BANDS)[number];

export const BAND_THRESHOLDS = {
  perfect: 100,
  great: 85,
  good: 70,
} as const;

/**
 * Accuracy as a whole number from 0 to 100.
 *
 *   accuracy = (1 - cost / max(|expected|, |received|)) * 100
 *
 * Dividing by the longer sequence keeps the score symmetric and inside [0, 100] without
 * clamping doing the real work — padding an answer with extra words is penalised just as
 * omitting words is. The result is still clamped, because a caller may pass a
 * hand-built alignment.
 *
 * A score of exactly 100 is reserved for a zero-cost alignment. Anything imperfect is
 * capped at 99 so a rounding artefact can never be presented as a perfect answer.
 */
export function accuracyFromAlignment(
  alignment: Alignment,
  expectedLength: number,
  receivedLength: number,
): number {
  if (expectedLength === 0 && receivedLength === 0) return 0;

  const denominator = Math.max(expectedLength, receivedLength);
  const raw = (1 - alignment.cost / denominator) * 100;
  const clamped = Math.min(100, Math.max(0, raw));

  if (alignment.cost === 0) return 100;
  return Math.min(99, Math.round(clamped));
}

export function bandFor(accuracy: number): Band {
  if (accuracy >= BAND_THRESHOLDS.perfect) return "perfect";
  if (accuracy >= BAND_THRESHOLDS.great) return "great";
  if (accuracy >= BAND_THRESHOLDS.good) return "good";
  return "tryAgain";
}

export const BAND_LABELS: Record<Band, string> = {
  perfect: "Perfect",
  great: "Great",
  good: "Good",
  tryAgain: "Try Again",
};
