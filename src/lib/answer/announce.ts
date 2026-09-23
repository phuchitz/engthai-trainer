import type { CheckResult } from "./check";
import { BAND_LABELS } from "./score";

export type AnnounceOptions = {
  /** XP paid for this answer, so the announcement carries the same news as the screen. */
  xpAwarded?: number;
  /** Speaking grades a transcript, and saying so stops a miss reading as bad pronunciation. */
  transcriptOnly?: boolean;
  /** Fill in the blank scores only the removed words. */
  blanksOnly?: boolean;
};

function list(words: string[], limit = 3): string {
  const shown = words.slice(0, limit).map((w) => `“${w}”`);
  const rest = words.length - shown.length;
  return rest > 0 ? `${shown.join(", ")} and ${rest} more` : shown.join(", ");
}

/**
 * The sentence a screen reader hears when an answer is graded.
 *
 * The visual feedback is a coloured label, a percentage and a colour-coded word diff —
 * none of which survives being read aloud, so the same three facts are spelled out in
 * words here: the verdict, the score, and which words were actually wrong.
 */
export function announceResult(result: CheckResult, options: AnnounceOptions = {}): string {
  const parts: string[] = [`${BAND_LABELS[result.band]}. ${result.accuracy} percent.`];

  if (options.blanksOnly) parts.push("Only the missing words were scored.");
  if (options.transcriptOnly) parts.push("Scored on transcript similarity, not pronunciation.");

  if (result.correct) {
    parts.push(
      result.matchedAlternative
        ? "Correct, matching an accepted alternative answer."
        : "Every word is correct.",
    );
  } else {
    if (result.missing.length > 0) {
      parts.push(`Missing ${result.missing.length === 1 ? "word" : "words"}: ${list(result.missing)}.`);
    }
    if (result.extra.length > 0) {
      parts.push(`Extra ${result.extra.length === 1 ? "word" : "words"}: ${list(result.extra)}.`);
    }
    if (result.substituted.length > 0) {
      const pairs = result.substituted.slice(0, 3).map((s) => `“${s.received}” should be “${s.expected}”`);
      const rest = result.substituted.length - pairs.length;
      parts.push(`${pairs.join(", ")}${rest > 0 ? `, and ${rest} more` : ""}.`);
    }
    // Most sentences already end in their own punctuation; appending another full stop
    // makes a screen reader read "hungry dot dot".
    parts.push(
      `Expected: ${/[.!?]$/.test(result.matchedAnswer.trim()) ? result.matchedAnswer : `${result.matchedAnswer}.`}`,
    );
  }

  if (options.xpAwarded && options.xpAwarded > 0) parts.push(`Plus ${options.xpAwarded} XP.`);

  return parts.join(" ");
}
