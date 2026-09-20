@AGENTS.md

# EngThai Trainer

Local-first, single-user English–Thai sentence trainer. Static-export Next.js PWA.
No backend, no auth, no multi-user. **Core features must work with AI disabled.**

## Layering (enforced by `no-restricted-imports` in eslint.config.mjs)

```
app/ -> components/ -> hooks/ -> stores/ -> lib/db/repositories/ -> lib/*
```

- `lib/answer`, `lib/srs`, `lib/exercises`, `lib/gamification` are **pure**: no React,
  no Zustand, no `idb`, no imports from the UI layer. Values in, values out.
- `lib/db/repositories/` is the only code that opens the database. UI never imports
  `idb` or `lib/db/client` directly.

## Answer checking

Typed Thai is checked **strictly** — tone marks and vowel signs are significant and
there is no fuzzy tolerance, because a lenient matcher silently teaches wrong spellings.
Strictness settings apply to the English side only. EN→TH production defaults to
word-order / tap-to-build exercises; free-typed Thai is opt-in.

The engine lives in `src/lib/answer` and is documented in
[docs/answer-checking.md](docs/answer-checking.md) — normalization rules, the weighted
edit-distance formula, the accuracy formula and the grading bands.

## Scheduling

`src/lib/srs` is a simplified SM-2 behind the `Scheduler` interface, documented in
[docs/spaced-repetition.md](docs/spaced-repetition.md). Intervals are whole **local
calendar days** anchored to midnight, and `isNew` (never practised) is kept strictly
separate from `isDue` (practised, scheduled day has arrived) — conflating them would let
the new-card limit throttle genuine reviews. The unit tests pin `TZ=Asia/Bangkok`.

## Data

Eight IndexedDB stores: `lessons`, `sentences`, `vocab`, `progress`, `attempts`,
`sessions`, `settings`, `meta`. `progress` is keyed per _(item, direction)_ so the two
directions schedule independently. `attempts` is append-only — every dashboard figure
is derived from it, never from a stored counter.

Timestamps are epoch milliseconds throughout, because numbers index and range-query
cleanly in IndexedDB.

Migrations are an append-only ladder in `lib/db/migrations/`: each version is a named,
separately tested `Migration`, and `migrationsToRun` replays every step a database is
behind, in order. **Never edit a released migration** — a learner three versions behind
replays it, so changing it changes their history.

**Never `await` between cursor steps in a migration.** A loop like
`for await (const cursor of store) { await cursor.update(...) }` silently backfills
nothing in a real browser, because awaiting lets the upgrade transaction auto-commit.
fake-indexeddb is more forgiving and passes it, so unit tests will not catch this —
read with `getAll()` and issue the writes together, and cover the upgrade in an e2e
test against a real browser (`tests/e2e/migration.spec.ts`).

Theme is deliberately not in the settings store: it must be readable synchronously
before first paint to avoid a flash, so it lives in localStorage and is read by a
pre-paint script in the root layout.

## Exercise modes

`src/lib/exercises` holds the pure per-mode logic; `MODE_INFO` is the single source of
truth for each mode's direction and languages.

Four modes (Dictation, Thai to English, Fill in the Blank, Speaking) train **producing
English** and therefore share the `th2en` card — audio, a Thai prompt and a gapped
sentence are different ways of asking for the same skill. Sentence Builder is the only
mode that asks for Thai, and it asks by **tapping tiles**, which is how Thai production
is trained here; it uses the `en2th` card and so schedules independently.

Two rules that are easy to get wrong:

- **Sentence Builder tiles are identified by index, not by text.** A sentence with a
  repeated word yields distinct tiles; keying by text would make duplicates
  interchangeable, so tapping one would consume the other.
- **Fill in the Blank scores only the removed words**, via `submitAnswer`'s `scoring`
  override. Grading the reassembled sentence flatters the learner, because the words
  that were never removed are always right.

Speaking is **transcript similarity, never pronunciation assessment**. The microphone is
off until explicitly enabled, the consent panel states that the browser may use an
external service, no audio is stored, and every failure path (unsupported, denied, no
microphone, no speech, network) falls back to self-assessed manual practice.

## XP, streaks and duplicate prevention

`src/lib/study/policy.ts` decides these, and every decision is **derived from the
append-only attempt log**, never from a flag on the progress row or anything held in
memory. That is what makes them survive a refresh, a resubmission or a second tab.

- XP is paid once per card per local calendar day, for the first passing answer.
- The schedule moves on the first _graded_ answer of the day, pass or fail — so drilling
  a card until it is right cannot buy a longer interval.
- A skip is logged but is never a success: no XP, no schedule move, and the card stays due.

## Commands

```
npm run check   # typecheck + lint + unit + build
npm run dev     # dev server
npm run e2e     # Playwright against the static export
```
