/**
 * Levenshtein distance over Unicode code points.
 *
 * The classic recurrence, where each insertion, deletion and substitution costs 1:
 *
 *   d(i, 0) = i
 *   d(0, j) = j
 *   d(i, j) = min( d(i-1, j) + 1,            // delete a[i-1]
 *                  d(i, j-1) + 1,            // insert b[j-1]
 *                  d(i-1, j-1) + cost )      // substitute, cost 0 when the units match
 *
 * Code points rather than UTF-16 units, so a Thai character outside the BMP or an
 * emoji counts as one edit rather than two.
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const left = Array.from(a);
  const right = Array.from(b);
  if (left.length === 0) return right.length;
  if (right.length === 0) return left.length;

  let previous = Array.from({ length: right.length + 1 }, (_, j) => j);
  let current = new Array<number>(right.length + 1);

  for (let i = 1; i <= left.length; i++) {
    current[0] = i;
    for (let j = 1; j <= right.length; j++) {
      const substitution = previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1);
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, substitution);
    }
    [previous, current] = [current, previous];
  }

  return previous[right.length];
}

/**
 * Character-level similarity of two words, in [0, 1].
 *
 *   similarity(a, b) = 1 - levenshtein(a, b) / max(|a|, |b|)
 *
 * Dividing by the longer word keeps the result symmetric and bounded, so "hungry" and
 * "hungy" score 0.833 rather than being judged simply unequal.
 */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const length = Math.max(Array.from(a).length, Array.from(b).length);
  if (length === 0) return 1;
  return 1 - levenshtein(a, b) / length;
}
