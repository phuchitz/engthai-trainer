import { similarity } from "./distance";

export type AlignOp =
  | { type: "match"; expected: string; received: string; expectedIndex: number; receivedIndex: number }
  | {
      type: "substituted";
      expected: string;
      received: string;
      expectedIndex: number;
      receivedIndex: number;
      similarity: number;
    }
  /** In the expected answer but absent from the learner's: a deletion. */
  | { type: "missing"; expected: string; expectedIndex: number }
  /** In the learner's answer but not the expected one: an insertion. */
  | { type: "extra"; received: string; receivedIndex: number };

export type Alignment = {
  ops: AlignOp[];
  /** Total edit cost, where a substitution costs less the closer the two words are. */
  cost: number;
};

/**
 * Word-level alignment by weighted Levenshtein over token sequences.
 *
 *   d(i, 0) = i
 *   d(0, j) = j
 *   d(i, j) = min( d(i-1, j) + 1,                       // missing word
 *                  d(i, j-1) + 1,                       // extra word
 *                  d(i-1, j-1) + sub(e[i-1], r[j-1]) )
 *
 *   sub(x, y) = 0                    when x === y
 *             = 1 - similarity(x, y) otherwise
 *
 * A substitution therefore costs between 0 and 1 rather than a flat 1: a single typo
 * inside one word of a ten-word sentence should not cost as much as the wrong word
 * entirely. Because a substitution never costs more than an insertion plus a deletion,
 * the recurrence still yields a genuine minimum-cost alignment.
 *
 * The backtrace prefers diagonal moves on ties, which keeps a substitution reported as
 * one substituted word instead of a separate missing and extra pair.
 */
export function alignWords(expected: string[], received: string[]): Alignment {
  const rows = expected.length;
  const cols = received.length;

  const cost: number[][] = Array.from({ length: rows + 1 }, () => new Array<number>(cols + 1).fill(0));
  for (let i = 1; i <= rows; i++) cost[i][0] = i;
  for (let j = 1; j <= cols; j++) cost[0][j] = j;

  const subCost = (a: string, b: string) => (a === b ? 0 : 1 - similarity(a, b));

  for (let i = 1; i <= rows; i++) {
    for (let j = 1; j <= cols; j++) {
      cost[i][j] = Math.min(
        cost[i - 1][j - 1] + subCost(expected[i - 1], received[j - 1]),
        cost[i - 1][j] + 1,
        cost[i][j - 1] + 1,
      );
    }
  }

  const ops: AlignOp[] = [];
  let i = rows;
  let j = cols;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const expectedWord = expected[i - 1];
      const receivedWord = received[j - 1];
      const diagonal = cost[i - 1][j - 1] + subCost(expectedWord, receivedWord);
      if (approximately(cost[i][j], diagonal)) {
        ops.push(
          expectedWord === receivedWord
            ? {
                type: "match",
                expected: expectedWord,
                received: receivedWord,
                expectedIndex: i - 1,
                receivedIndex: j - 1,
              }
            : {
                type: "substituted",
                expected: expectedWord,
                received: receivedWord,
                expectedIndex: i - 1,
                receivedIndex: j - 1,
                similarity: similarity(expectedWord, receivedWord),
              },
        );
        i -= 1;
        j -= 1;
        continue;
      }
    }

    if (i > 0 && approximately(cost[i][j], cost[i - 1][j] + 1)) {
      ops.push({ type: "missing", expected: expected[i - 1], expectedIndex: i - 1 });
      i -= 1;
      continue;
    }

    ops.push({ type: "extra", received: received[j - 1], receivedIndex: j - 1 });
    j -= 1;
  }

  ops.reverse();
  return { ops, cost: cost[rows][cols] };
}

/** Substitution costs are fractional, so the backtrace compares with a tolerance. */
function approximately(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-9;
}

export function missingWords(alignment: Alignment): string[] {
  return alignment.ops.filter((op) => op.type === "missing").map((op) => op.expected);
}

export function extraWords(alignment: Alignment): string[] {
  return alignment.ops.filter((op) => op.type === "extra").map((op) => op.received);
}

export function substitutedWords(alignment: Alignment): { expected: string; received: string }[] {
  return alignment.ops
    .filter((op) => op.type === "substituted")
    .map((op) => ({ expected: op.expected, received: op.received }));
}
