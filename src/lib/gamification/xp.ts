import type { Band } from "@/lib/answer";

/**
 * XP is only awarded for a pass. "Good" and "Try Again" produce a materially different
 * sentence, and paying for those would make the number meaningless.
 */
export const XP_BY_BAND: Record<Band, number> = {
  perfect: 10,
  great: 6,
  good: 0,
  tryAgain: 0,
};

/** Using the hint halves the award, rounded down. It is help, not a penalty. */
export const HINT_MULTIPLIER = 0.5;

export type XpInput = {
  band: Band;
  hintUsed: boolean;
};

export function xpForAnswer({ band, hintUsed }: XpInput): number {
  const base = XP_BY_BAND[band];
  return hintUsed ? Math.floor(base * HINT_MULTIPLIER) : base;
}
