# How the numbers are calculated

Every figure on the Dashboard is **recomputed from the append-only attempt log** plus the
single settings row. Nothing is read from a stored counter, so no number can drift out of
step with what actually happened, and re-deriving after an import gives the right answer
for whatever history the file brought with it.

The one thing written down rather than recomputed is `Attempt.xpAwarded` — see
[XP](#xp) for why.

## Active study time

`src/lib/gamification/studyTime.ts`

Wall-clock time is a bad measure of study: leaving a card open over lunch would score an
hour of practice. Active time excludes two things.

**Background time.** Nothing accrues between a `hidden` event and the next `visible`
one, so a backgrounded tab or a locked phone contributes zero.

**Idle time.** Any stretch without a sign of life counts for at most `idleTimeoutMs`
(**60 seconds**). Thinking for three minutes with no keystroke banks one minute, not
three. The cap is what makes this an _activity_ measure rather than a presence one.

A "sign of life" is any keypress in the exercise screen. Each idle stretch is capped
separately, so two three-minute pauses bank two minutes in total, not one.

`stop` is terminal: events arriving after a card is finished are ignored, so a stale
listener cannot inflate the total.

The timer runs **per card**, from the card appearing to the answer being submitted. Time
spent reading the feedback panel is not counted. The result is stored on the attempt as
`durationMs`, and the Dashboard simply sums those — so the daily and all-time totals are
a sum of already-filtered values, not a fresh calculation.

## Accuracy

`src/lib/gamification/accuracy.ts`

```
accuracy = passing attempts / graded attempts
```

- **Graded** excludes skips. Declining to answer is not a wrong answer.
- **Passing** means the verdict was `correct` or `close`, which matches the XP and streak
  rules exactly — an exact answer or a near miss.
- **Every graded attempt counts**, not just the first for each card. Retrying a card
  until it is right therefore lowers accuracy. That is the honest reading: the figure
  measures how often answers are right, not whether the learner eventually got there.
- Zero graded attempts reports `0`, never `NaN`. The UI shows `—` in that case rather
  than a misleading zero percent.

Rounded to the nearest whole percent.

## Daily goal

`sentencesCompletedToday` counts **distinct sentences passed today**, in the local
calendar day.

Deliberately not the same as cards passed: a sentence has one card per direction, so
practising both would otherwise tick the goal twice for one sentence. A sentence failed
and then passed counts once, as does a sentence passed three times.

## Lesson completion percentage

`src/lib/study/stats.ts`

```
completion = sentences answered correctly at least once / sentences in the category
```

"At least once" means any progress row for the sentence has `correctCount > 0`, in either
direction. A category with no sentences reports 0% rather than dividing by zero.

This is a coverage measure, not a mastery one: it answers "how much of this category have
I got right at least once", which is what a progress bar on a lesson list should mean.
Mastery is what the memory level and the schedule express.

## XP

XP is awarded **once per card per local calendar day**, for the first passing answer:
10 for an exact answer, 6 for a near miss, halved when the hint was used.

The amount is recorded on the attempt as `xpAwarded` rather than recomputed. The stored
verdict cannot distinguish a `great` from a `good` — both are `close` — so replaying the
log would guess. Writing down what was actually paid keeps the running total exact.
Attempts recorded before this field existed carry `0`; the amount is unrecoverable and
inventing one would corrupt the total.

## Streak

`src/lib/gamification/streak.ts`

Counted in **local calendar days**, not 24-hour windows: studying at 23:50 and again at
00:10 is two days, and studying twice in one evening is one.

The Dashboard shows `currentStreak`, which is not always the stored value — a streak
whose last study day is older than yesterday has already been broken even though nothing
has written to it since.

## Achievements

`src/lib/gamification/achievements.ts`

Badges are **derived, never stored**: each is a predicate over the current stats. So a
badge cannot be out of date, cannot be awarded twice, and the end-of-session summary can
report exactly what _that session_ unlocked by comparing a snapshot taken at the start
against the stats at the end.
