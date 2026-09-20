# Spaced repetition

`src/lib/srs` decides when an item comes back. Like the answer checker it is pure
TypeScript — no React, no IndexedDB, no clock, no randomness — so a whole year of study
can be simulated in a unit test.

The scheduler is reached through the `Scheduler` interface, and the concrete
implementation is a simplified SM-2 exported as `sm2Scheduler` (also as
`defaultScheduler`). Keeping the interface means a different algorithm — FSRS, say — can
replace it later without touching callers.

```ts
review(state: SchedulingState, rating: Rating, reviewedAt: number): SchedulingPatch;
```

`SchedulingState` is a narrow slice of `SentenceProgress`: the module never sees the
whole record, and `reviewedAt` is passed in rather than read from the clock, which is
what makes the function deterministic and testable.

## Ratings

Four ratings instead of SM-2's six-point quality scale — the extra resolution was never
something a learner could self-report, and it rarely changed the resulting schedule.

`ratingFromResult` maps an answer-checking result onto one:

| Result               | Rating  | Why                                                        |
| -------------------- | ------- | ---------------------------------------------------------- |
| exact match          | `good`  | A clean pass                                               |
| `great` band (85–99) | `hard`  | Still a pass. An English typo should not wipe out a streak |
| `good` band (70–84)  | `again` | A materially different sentence                            |
| `tryAgain` band      | `again` | Wrong                                                      |

Thai grading only ever produces `perfect` or `tryAgain`, so a Thai answer is only ever a
clean pass or a clean lapse — `hard` never arises there.

`easy` exists in the type but is not produced by that mapping. It is reserved for modes
where the learner grades themselves, such as speaking.

## Ease factor

SM-2's difficulty measure. Starts at **2.5** and moves by a fixed step per rating rather
than by SM-2's quadratic in `q` — same direction, far easier to reason about:

| Rating  | Change |
| ------- | ------ |
| `again` | −0.20  |
| `hard`  | −0.15  |
| `good`  | 0      |
| `easy`  | +0.15  |

Clamped to **[1.3, 3.5]**. The floor is SM-2's own; the ceiling matches the schema bound
so a patch always validates. The updated ease is what the interval calculation uses.

`SentenceProgress.stability` and `.difficulty` are FSRS fields and are deliberately left
untouched by this scheduler.

## Intervals

```
again                     -> 0 days   (due again today)
first success  (streak 0) -> 1 day
second success (streak 1) -> 6 days
later successes           -> round(previous * multiplier), capped at 365

multiplier = 1.2          when hard
           = ease         when good
           = ease * 1.3   when easy
```

"Streak" is `consecutiveSuccesses` **before** this review, which is what makes the two
graduating steps fire in order.

A lapse sets the interval to **0**, not 1. The card becomes due the same day, so a failed
item comes back within the session rather than tomorrow. Ease takes a penalty, but what
is really lost is the accumulated interval — an item on a 120-day schedule goes straight
back to the 1-day step.

Growth is capped at **365 days**. Beyond a year the schedule has stopped being a useful
recall signal. The cap also contains a nonsense interval arriving from an imported file,
and `Math.max(intervalDays, 6)` repairs a record whose interval is smaller than its
streak implies.

A typical clean run: **1, 6, 15, 38, 95, 238, 365…**

## Memory level

The learner-facing band, derived from the interval:

| Interval        | Level      |
| --------------- | ---------- |
| never practised | `new`      |
| under 7 days    | `learning` |
| 7–20 days       | `familiar` |
| 21–89 days      | `known`    |
| 90 days or more | `mastered` |

Because a lapse resets the interval, a lapsed card drops back to `learning` — which is
what the learner should be told.

`SrsState` is the separate internal state: `new` before the first review, `learning`
until two consecutive successes, then `review`; a lapse on an established card is
`relearning`.

## Local calendar days

Scheduling is a calendar concept, not an elapsed-hours one. A card scheduled for Thursday
is due from the moment Thursday begins, whether it was answered at 07:00 or 23:00 the
week before.

So `nextReviewAt` is always **local midnight** of the target day, produced by
`addLocalDays`, which uses `Date.setDate` rather than adding milliseconds — across a
daylight-saving boundary a day is 23 or 25 hours, not 24.

`localDateKey` gives the `YYYY-MM-DD` key used for streaks and the review heatmap.

Because this depends on the runtime timezone, the unit tests pin `TZ=Asia/Bangkok` and
assert that the pin took effect before relying on it.

## New versus due

Two states that must never be conflated:

- **`isNew`** — never practised. No schedule to be late for, and gated by the daily
  new-card allowance.
- **`isDue`** — practised before, and its scheduled calendar day has arrived or passed.
  A promise the scheduler made, and _not_ subject to the new-card allowance.

Both exclude suspended cards. They are disjoint by construction, and a card scheduled in
the future is neither.

Conflating them would make the backlog look enormous on day one, and would let the
new-card limit silently throttle genuine reviews.

`buildQueue` composes them into one session: reviews first, longest-overdue first, then
new cards up to the allowance. `totalDue` and `totalNew` report what exists _before_ the
caps, so the UI can say "50 due, showing 20".
