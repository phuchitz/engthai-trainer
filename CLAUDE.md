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

Theme is deliberately not in the settings store: it must be readable synchronously
before first paint to avoid a flash, so it lives in localStorage and is read by a
pre-paint script in the root layout.

## Commands

```
npm run check   # typecheck + lint + unit + build
npm run dev     # dev server
npm run e2e     # Playwright against the static export
```
