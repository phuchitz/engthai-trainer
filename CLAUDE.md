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

## Review, vocabulary and the word panel

Two review queues, kept separate and allowed to overlap: `isDue` (the scheduler's
promise) and `isMistake` (`incorrectCount > 0`, **independent of the schedule**, because
the point of a mistake drill is to work on weak items now). Mistakes rank by a
Laplace-smoothed failure rate, `incorrectCount / (practiceCount + 1)`, so one failure out
of one does not outrank five out of nine.

A review card carries its **own mode**, derived from its direction — `StudyCard` is
`{ sentence, mode }` and a review queue mixes modes. Asking an `en2th` card as dictation
would test the wrong skill.

**The word panel never invents dictionary data.** Only hand-written entries in
`src/content/seed/vocabulary.ts` are shown; a word with no entry gets an explicit
"not curated" state, and a missing IPA renders nothing. Tapped words resolve through the
entry's authored `forms` list — **no stemming**, because a wrong stem attaches the wrong
definition to a word.

Encounter counts are **derived from the attempt log** (via each sentence's curated
`vocabIds`), never stored as a counter. Opening the panel is not an encounter.

## Seeding built-in content

The seed loader inserts missing rows _and refreshes existing ones while they are still
`source: "builtin"`_. That marker means "the learner has not taken ownership". **Anything
that edits a sentence or word must set `source` to `"user"`**, which makes it permanently
theirs. Without the refresh, an improved translation or a new vocabulary link could only
ever reach a fresh install.

The deck is fifty sentences in `src/content/seed/starter.ts` and ninety-six vocabulary
entries in `vocabulary.ts`, across Daily (10), Software (15), Meetings (10), Interviews
(10) and Workplace (5). **Travel and Custom are deliberately empty** — Custom is where
imports land, and an empty Travel keeps the Lessons screen's empty-category path
exercised by real data.

Three rules the corpus has to keep, all enforced by `tests/unit/seed-content.test.ts`
rather than by care:

- **Never reuse a sentence id for different content.** A refresh replaces the row in
  place, so the learner would keep one sentence's schedule against another's text.
- **Every curated word must be reachable by tapping one word of its own sentence.**
  `buildVocabLookup` keeps the _first_ entry that claims a surface form and silently
  drops later claims, so a clash attaches the wrong definition with no error anywhere.
  A multi-word headword therefore needs a single-word form ("heads up" via "heads"), and
  a possessive is its own form ("team's").
- **No symbols, digits or dashes in the English.** Every sentence is read aloud by
  Dictation and Speaking and typed back by hand, so notation tests punctuation rather
  than English.

## Optional AI

Off by default, and **this build registers no provider at all**. `src/lib/ai` is
documented in [docs/ai.md](docs/ai.md).

- **No credential lives anywhere in this app.** Not in code, an env var, localStorage,
  IndexedDB or a commit — this is a static export, so anything the browser holds is
  public. The settings schema deliberately has no key field, and **migration v5 strips
  `ai.apiKey`** from any row that still has one. A credentialed provider needs a
  server-side adapter holding its own secret; that adapter is not built here.
- **`disabledProvider` is a real implementation that refuses every call**, not a `null`
  callers must check. The AI paths run on every load, so no feature can quietly come to
  depend on AI being present.
- **Two consent gates**, both checked _before_ a request is built: a provider must be
  configured and on, **and** `ai.consentGivenAt` must be set. Enabling is not agreement.
- **Every response is validated with Zod** before use — `runCapability` re-validates
  even when the provider's types already claim the right shape. No AI schema can supply
  an IPA or a dictionary entry; the word panel stays hand-written only.
- The Settings disclosure is generated from the request objects, so it cannot drift away
  from the payload.

## Import, export and backup

Documented in [docs/import-export.md](docs/import-export.md): field defaults, CSV and
paste separators, duplicate rules and the backup format.

The rules that matter:

- **Adding lessons and replacing everything are separate flows**, on separate tabs.
  Mixing them makes it far too easy to wipe a month of progress while meaning to add ten
  sentences.
- **Nothing is written until the preview is confirmed.** Every row is validated with Zod
  and shown with its line number, its status and any warnings.
- **Duplicates match on normalized English**, using the answer checker's own normalizer,
  both against stored sentences and against earlier rows in the same file. Default is
  skip; "update existing" reuses the **existing sentence id**, which is what preserves
  the schedule and the answer log.
- **A backup is validated in full before anything is touched**, then applied in one
  transaction. `formatVersion` is separate from `DB_VERSION`: the file has to stay
  readable after the schema moves on.
- **Never report success that did not happen.** Export checks the download was accepted,
  delete reopens and counts, and a blocked delete fails loudly rather than hanging.

## Dashboard metrics

Every Dashboard figure is recomputed from the attempt log — see
[docs/metrics.md](docs/metrics.md) for the exact definitions of accuracy, active study
time and lesson completion.

Three that are easy to get wrong:

- **Active study time** excludes background stretches (nothing accrues while
  `document.hidden`) and caps each idle stretch at 60 seconds, so the figure measures
  activity rather than presence. It is recorded per card on `Attempt.durationMs`.
- **The daily goal counts distinct sentences**, not cards. A sentence has a card per
  direction, so counting cards would tick the goal twice for one sentence.
- **Accuracy counts every graded attempt**, so retrying until right lowers it. Skips are
  excluded entirely. Zero graded answers shows `—`, never `0%`.

`Attempt.xpAwarded` is the one figure written down rather than replayed: the stored
verdict cannot tell a `great` from a `good`, so recomputing would guess.

Achievements are predicates over the stats, never stored flags.

## XP, streaks and duplicate prevention

`src/lib/study/policy.ts` decides these, and every decision is **derived from the
append-only attempt log**, never from a flag on the progress row or anything held in
memory. That is what makes them survive a refresh, a resubmission or a second tab.

- XP is paid once per card per local calendar day, for the first passing answer.
- The schedule moves on the first _graded_ answer of the day, pass or fail — so drilling
  a card until it is right cannot buy a longer interval.
- A skip is logged but is never a success: no XP, no schedule move, and the card stays due.

## Offline, installation and accessibility

Both documented in [docs/pwa-and-accessibility.md](docs/pwa-and-accessibility.md).

- **The service worker's precache list is generated from `out/`**, by
  `scripts/generate-sw.mjs` after `next build`. Chunk names are content hashes, so a
  hand-written list goes stale the first time a chunk changes — and a shell missing one
  chunk is a shell that does not open. The cache name is a hash of the whole build, so a
  rebuild can never mix two builds' chunks.
- **Offline, an unknown URL gets a 404, never the dashboard.** A wrong page claiming to
  be the right one is worse offline, because nothing arrives to correct it.
- **Nothing is registered in development**, and a leftover production worker on the same
  origin is unregistered.
- **Contrast is a unit test, not a judgement call.** `tests/unit/contrast.test.ts` parses
  `globals.css` and checks every token pair in both themes. It caught three failures that
  had been shipping for several sessions.
- **The focus rule uses element selectors, not `:where()`**, because several inputs carry
  Tailwind's `outline-none` and a zero-specificity selector would lose to it.
- **A grade is announced in words.** `announceResult` restates the verdict, the score and
  the specific wrong words, because the visible feedback is a colour. Its live region is
  mounted for the whole session and empty until needed — a region added at the same
  moment as its text is routinely missed.

## Testing

`tests/unit` is Vitest with fake-indexeddb and `TZ=Asia/Bangkok`; `tests/e2e` is
Playwright against the static export in `out/`. **`npm run e2e` does not build** — run
`npm run build` first or it tests a stale bundle.

- **Cover a migration's upgrade body in e2e, not only in a unit test.** fake-indexeddb is
  more permissive than a real IndexedDB, which is how the v2 cursor bug shipped.
- **Content is verified by `tests/unit/seed-content.test.ts`**, not by care: a vocabulary
  id with a typo, an unreachable word or notation in an English sentence fails there.
- `getByText` matches substrings **case-insensitively**, so a heading that also appears
  inside a description needs `{ exact: true }`.
- **Wait for the graded panel before reading anything it produced.** Submitting persists
  asynchronously; reading the live region straight after the click is a race that passes
  alone and fails under parallel load.

Four things no automated test here can prove, and that need a human in a real browser:
Chrome's speech recogniser actually firing its events, the microphone permission prompt,
a real microphone being picked up, and how accented English is transcribed. The browser
pane in this environment also refuses to fetch service-worker scripts, so PWA checks run
through Playwright's Chromium.

## Commands

```
npm run check   # typecheck + lint + unit + build
npm run icons   # redraw the PWA icons from scripts/generate-icons.mjs
npm run dev     # dev server
npm run e2e     # Playwright against the static export
```
