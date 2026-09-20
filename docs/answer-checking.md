# Answer checking

`src/lib/answer` grades a typed answer. It is pure TypeScript — no React, no IndexedDB,
no I/O — so all five exercise modes can share it and it can be tested exhaustively
without a browser. The entry point is `checkAnswer(userAnswer, expected, options)`.

## Normalization

Applied to the learner's answer and to every accepted answer alike, so both sides are
compared on equal terms.

**English** (`normalizeEnglish`)

| Step                 | Effect                                                                    |
| -------------------- | ------------------------------------------------------------------------- |
| Unicode NFC          | `cafe` + combining acute becomes `café`, so equality holds                |
| Invisible characters | Zero-width space/joiner and the BOM are dropped                           |
| Apostrophes          | `’ ‘ ‛ ʼ ʹ ′ ´ \`` all become `'`                                         |
| Dashes               | Hyphen, en dash, em dash and minus all become `-`                         |
| Case                 | Lowercased (`ignoreCase: false` to disable)                               |
| Punctuation          | Every `\p{P}`/`\p{S}` becomes a space, **except** `'` and `-`             |
| Edge marks           | `'` and `-` are dropped unless flanked by a letter or digit on both sides |
| Whitespace           | Runs collapse to one space; the result is trimmed                         |

The two-step apostrophe handling is what preserves contractions. `'hello'` loses its
quotes because neither apostrophe has a letter on both sides, while `don't` and
`well-known` keep their mark because both do.

Contractions are **not** expanded: `don't` and `do not` are different answers. Authors
who want both accepted should add one as an alternative.

**Thai** (`normalizeThai`) does only NFC, invisible-character removal and whitespace
collapsing. Tone marks and vowel signs are never folded away — they are combining
characters that change the word, so removing them would silently accept a different
word as correct.

## Tokenization

English splits on whitespace. Thai is written without spaces between words, so tokens
come from `Intl.Segmenter` word segmentation, keeping only word-like segments. Where
`Intl.Segmenter` is unavailable the whole run becomes one token: comparison still works,
the word-level diff is just coarser.

## Word alignment

`alignWords(expected, received)` is a weighted Levenshtein over token sequences:

```
d(i, 0) = i
d(0, j) = j
d(i, j) = min( d(i-1, j)   + 1,                     // missing word  (deletion)
               d(i, j-1)   + 1,                     // extra word    (insertion)
               d(i-1, j-1) + sub(e[i-1], r[j-1]) )  // substitution

sub(x, y) = 0                      when x === y
          = 1 - similarity(x, y)   otherwise

similarity(x, y) = 1 - levenshtein(x, y) / max(|x|, |y|)
```

`levenshtein` is the standard unit-cost recurrence over **Unicode code points**, so an
astral character counts as one edit rather than two.

A substitution costs between 0 and 1 rather than a flat 1. This matters: with a flat
cost, one typo in a three-word sentence scores 67% and reads as a failure. Weighted,
`hungy` for `hungry` costs 0.167 and the sentence scores 94%. Because a substitution
never costs more than an insertion plus a deletion, the recurrence still produces a
genuine minimum-cost alignment.

The backtrace prefers the diagonal on ties, so a changed word is reported as one
`substituted` op rather than a `missing`/`extra` pair. Ops come back in reading order,
each carrying its index into both sequences, which is what the UI needs to underline the
right words. `missingWords`, `extraWords` and `substitutedWords` pull out the three
categories.

Word **order** is significant: a reordered sentence costs edits rather than being
accepted.

## Accuracy

```
accuracy = (1 - cost / max(|expected|, |received|)) * 100
```

Dividing by the longer sequence keeps the score symmetric and inside 0–100 by
construction, so padding an answer with extra words is penalised exactly as omitting
words is. The result is clamped and rounded to a whole number.

**100 is reserved for a zero-cost alignment.** Any imperfect answer is capped at 99, so
a rounding artefact can never be presented as perfect.

Empty input is safe: an empty or whitespace-only answer scores 0 with every expected
word reported missing, and an empty answer is never `correct` — not even against an
empty expectation.

## Bands

| Accuracy | Band       | Label     |
| -------- | ---------- | --------- |
| 100      | `perfect`  | Perfect   |
| 85–99    | `great`    | Great     |
| 70–84    | `good`     | Good      |
| below 70 | `tryAgain` | Try Again |

## Accepted alternatives

`options.alternatives` holds extra answers the author marked acceptable. Every accepted
answer — the primary plus each alternative — is scored, and the best result wins.

An alternative therefore **can never be reported as wrong**, and the returned diff is
against whichever wording the learner was actually aiming at. `matchedAnswer` says which
one that was and `matchedAlternative` whether it was an alternative. On a tie the
primary answer wins, because it is listed first.

## Thai is graded strictly

English tolerance exists because case, punctuation and a slipped key do not change the
sentence. In Thai a tone mark or a vowel sign _is_ the difference between two words, so
anything short of an exact match after normalization is `tryAgain`, however high the
accuracy figure.

The accuracy figure is still computed and returned, so the UI can show how near the
learner came. Being told "94%, but this is not the word you wanted" is useful; being
told "correct" when it was not would teach the wrong spelling.

This is why `Settings.strictness`, `ignoreCase` and `ignorePunctuation` are documented
as English-only, and why there is deliberately no setting to relax Thai.
