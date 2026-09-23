# EngThai Trainer

A local-first English–Thai sentence trainer, built for a Thai software engineer who wants
the English their job actually needs: code review, standups, interviews and the small
courtesies around them.

Everything runs in the browser. There is **no backend, no account and no telemetry** —
your sentences, your answers and your schedule never leave your device. It installs as an
app and works offline. Several people can share a device through local profiles, each
with their own progress.

|             |                                                                                  |
| ----------- | -------------------------------------------------------------------------------- |
| **Stack**   | Next.js 16 (App Router, static export), TypeScript, Tailwind CSS 4, Zustand, Zod |
| **Storage** | IndexedDB, eight stores, versioned migrations                                    |
| **Tests**   | Vitest (unit) and Playwright (end to end)                                        |
| **Content** | 50 curated sentences and 96 vocabulary entries across 5 categories               |

---

## Setup

Requires **Node 20.9 or newer** (Next 16's floor). Developed on Node 24.

```bash
npm install
```

Then, for the end-to-end suite only, install the browser Playwright drives:

```bash
npx playwright install chromium
```

## Commands

```bash
npm run dev          # dev server on http://localhost:3000
npm run build        # production build -> out/, then generates out/sw.js
npm run preview      # serve the built export on http://localhost:3100
npm run test         # unit tests
npm run test:coverage # unit tests with a coverage report
npm run e2e          # Playwright against the built export
npm run check        # format check + typecheck + lint + unit tests + build
npm run icons        # redraw the PWA icons from scripts/generate-icons.mjs
```

`npm run e2e` starts its own server from `out/`, so **run `npm run build` first** or the
suite will test a stale bundle.

---

## Architecture

A strict one-way dependency chain, enforced by `no-restricted-imports` in
`eslint.config.mjs` rather than by good intentions:

```
app/ → components/ → hooks/ → stores/ → lib/db/repositories/ → lib/*
```

```
src/
  app/                 routes: / (dashboard), /lessons, /learn, /review,
                       /vocabulary, /data, /settings
  components/          screens, exercise inputs, the word panel, layout
  stores/              Zustand: library, settings, study session, vocabulary
  lib/
    answer/            normalization, word alignment, scoring        (pure)
    srs/               simplified SM-2 behind a Scheduler interface  (pure)
    exercises/         per-mode logic for the five exercise types    (pure)
    gamification/      XP, streaks, achievements, active-time timer  (pure)
    study/             grading flow, queues, dashboard aggregation
    importexport/      CSV/JSON/paste parsing, plans, backups
    speech/            Web Speech API wrappers
    ai/                the optional provider interface (no provider registered)
    db/                client, migration ladder, repositories
  content/seed/        the built-in deck
```

**The four pure packages take values in and return values out.** No React, no Zustand, no
IndexedDB, no imports from the UI. That is why the hard parts — scoring, scheduling — are
cheap to test exhaustively.

**`lib/db/repositories/` is the only code that opens the database.** The UI never touches
`idb` directly.

### Data

Eight IndexedDB stores: `lessons`, `sentences`, `vocab`, `progress`, `attempts`,
`sessions`, `settings`, `meta`.

- `progress` is keyed per **(item, direction)**, so English→Thai and Thai→English
  schedule independently.
- `attempts` is **append-only**. Every dashboard figure is recomputed from it, never read
  from a stored counter — so nothing can drift, and a refresh or a second tab cannot
  double-count.
- Timestamps are epoch milliseconds throughout, because numbers index and range-query
  cleanly in IndexedDB.
- Migrations are an append-only ladder in `lib/db/migrations/`. A released migration is
  never edited: a learner three versions behind replays it.

Theme is deliberately **not** in the settings store. It has to be readable synchronously
before first paint to avoid a flash, so it lives in `localStorage` and is read by a
pre-paint script in the root layout.

---

## Exercise modes

| Mode              | Prompt         | You produce       | Card    |
| ----------------- | -------------- | ----------------- | ------- |
| Dictation         | audio          | typed English     | `th2en` |
| Thai to English   | Thai text      | typed English     | `th2en` |
| Fill in the Blank | gapped English | the missing words | `th2en` |
| Speaking          | audio          | spoken English    | `th2en` |
| Sentence Builder  | English        | tapped Thai tiles | `en2th` |
| Multiple Choice   | Thai text      | a pick from four  | `th2en` |

The first four are different ways of asking for the **same skill**, so they share one
card and one schedule. Sentence Builder is the only mode that asks for Thai, and it asks
by tapping tiles — so it uses the other card and schedules independently.

**Multiple Choice is practice only.** It pays XP and is logged like any other answer, and
a wrong pick is recorded against the card, but it is the one mode that **never advances
the schedule**: picking the right sentence out of four is an easier act than producing
it, and it should not buy a review interval on a card scheduled for production. Doing it
first does not consume the card's schedule move either — the typed answer that follows
still counts.

Its wrong answers are **real sentences from your own library**, drawn from the same
category where there are enough of them, because a distractor from another topic can be
ruled out without reading the Thai at all. It is graded **all or nothing**: the
alternatives sit a word or two from the answer, so partial credit would report a
comfortable score for a question you simply got wrong.

Three details that are easy to get wrong:

- **Sentence Builder tiles are identified by index, not by text.** A sentence with a
  repeated word yields two distinct tiles; keying by text would make tapping one consume
  the other.
- **Fill in the Blank scores only the removed words.** Grading the reassembled sentence
  flatters the learner, because the words that were never removed are always right.
- **Multiple Choice never invents a wrong answer.** If your library is too small to offer
  real alternatives, the screen says so and points you at import rather than padding the
  question out with generated text.

---

## Scoring rules

Full detail in [docs/answer-checking.md](docs/answer-checking.md).

**Normalization** (English only): lower-cased, whitespace collapsed, curly and straight
apostrophes unified so contractions survive, non-essential punctuation ignored.

**Thai is checked strictly.** Tone marks and vowel signs are significant and there is no
fuzzy tolerance, because a lenient matcher silently teaches wrong spellings. The
strictness settings apply to the English side only.

**Alignment** is a weighted Levenshtein over word tokens. A missing or extra word costs
1; a substitution costs less the closer the two words are, so "yesterday" for "tomorrow"
still earns partial credit for the letters it shares.

```
accuracy = (1 - cost / max(|expected|, |received|)) * 100
```

Dividing by the longer sequence keeps the score symmetric: padding an answer with extra
words is penalised exactly as omitting them is. The result is clamped to 0–100 and is
safe on empty input.

**Bands and XP:**

| Band      | Accuracy | XP  |
| --------- | -------- | --- |
| Perfect   | 100      | 10  |
| Great     | 85–99    | 6   |
| Good      | 70–84    | 0   |
| Try Again | below 70 | 0   |

Using the hint halves the award, rounded down. XP is only paid for a pass — paying for a
"Good" would make the number meaningless.

**Accepted alternatives are never wrong.** A sentence carries `enAlternates`, and the
checker scores against whichever accepted answer the learner came closest to. Being told
you are wrong when you are not is the fastest way to stop trusting a trainer.

### XP, streaks and duplicate prevention

All three are **derived from the append-only attempt log**, never from a flag, which is
what makes them survive a refresh, a resubmission or a second tab:

- XP is paid **once per card per local calendar day**, for the first passing answer.
- The schedule moves on the first _graded_ answer of the day, pass or fail — so drilling
  a card until it is right cannot buy a longer interval.
- A **skip is never a success**: no XP, no schedule move, and the card stays due.
- The daily goal counts **distinct sentences**, not cards, so one sentence answered in
  both directions ticks it once.

---

## Review scheduling

A simplified **SM-2**, behind a `Scheduler` interface so FSRS could replace it. Full
detail in [docs/spaced-repetition.md](docs/spaced-repetition.md).

Intervals are whole **local calendar days** anchored to midnight, not rolling 24-hour
windows — "tomorrow" means tomorrow, whatever time you studied.

| Event        | Interval                                         |
| ------------ | ------------------------------------------------ |
| First pass   | 1 day                                            |
| Second pass  | 6 days                                           |
| Later passes | previous × ease (× 1.2 for Hard, × 1.3 for Easy) |
| A lapse      | 0 days — due again the same day                  |

Ease starts at 2.5, is bounded to 1.3–3.5, and moves by −0.2 (Again), −0.15 (Hard), 0
(Good) or +0.15 (Easy). Intervals are capped at **365 days**: beyond a year the schedule
stops being a useful recall signal.

The learner-facing memory bands come from the interval: _familiar_ at 7 days, _known_ at
21, _mastered_ at 90.

**`isNew` and `isDue` are kept strictly separate.** New means never practised; due means
practised and the scheduled day has arrived. Conflating them would let the new-card limit
throttle genuine reviews.

### The two review queues

They are separate, and they are allowed to overlap:

- **Due** — what the scheduler promised, longest-overdue first.
- **Mistakes** — anything with `incorrectCount > 0`, **independent of the schedule**,
  because the point of a mistake drill is to work on weak items _now_. Ranked by a
  Laplace-smoothed failure rate, `incorrectCount / (practiceCount + 1)`, so one failure
  out of one does not outrank five out of nine.

A review card carries **its own mode**, derived from its direction: a `th2en` card is
reviewed as a translation, an `en2th` card by building tiles. A review queue therefore
mixes modes.

---

## Import formats

Full detail, including every default, in [docs/import-export.md](docs/import-export.md).

Required fields are `english` and `thai`. Everything else is optional; `level` defaults to
`A1` and `category` to `custom`.

**JSON** — a bare array, or `{ "sentences": [...] }`:

```json
[
  {
    "english": "I am very hungry.",
    "thai": "ฉันหิวมาก",
    "level": "A1",
    "category": "daily",
    "acceptedAnswers": ["I'm very hungry."],
    "vocabulary": [{ "en": "hungry", "th": "หิว" }],
    "examples": [{ "en": "I am very tired.", "th": "ฉันเหนื่อยมาก" }],
    "grammarExplanation": "ไม่ต้องมี verb to be ตรงนี้"
  }
]
```

**CSV** — headers `english,thai` plus any optional columns. Quoted fields may contain
commas and newlines. List columns (`vocabulary`, `examples`, `acceptedAnswers`) separate
items with `;` and the two sides of a pair with `=`:

```csv
english,thai,level,vocabulary
"Hello, how are you?",สวัสดีสบายดีไหม,A1,hello=สวัสดี;how=อย่างไร
```

**Paste** — one pair per line, separated by a tab or a `|`:

```
Where are you going? | คุณจะไปไหน
See you tomorrow | แล้วเจอกันพรุ่งนี้
```

Three rules hold for every format:

- **Nothing is written until you confirm the preview.** Every row is validated with Zod
  and shown with its line number, its status and any warnings.
- **Duplicates match on normalized English**, using the answer checker's own normalizer —
  both against what is stored and against earlier rows in the same file.
- The default is **skip**. Choosing "update existing" reuses the **existing sentence id**,
  which is what preserves the schedule and the answer log.

---

## Backup and restore

Adding lessons and replacing everything are **separate flows on separate tabs**. Mixing
them makes it far too easy to wipe a month of progress while meaning to add ten sentences.

- **Export** writes a single versioned JSON file containing the whole database —
  sentences, vocabulary, progress, every attempt, sessions and settings.
- `formatVersion` is deliberately **separate from `DB_VERSION`**, so a file stays readable
  after the schema moves on.
- **Restore validates the entire file before touching anything**, then applies it in one
  transaction, and requires an explicit confirmation because it replaces everything.
- **Delete all data** offers a backup first and requires you to type the confirmation word.

**Nothing reports success that did not happen.** Export checks the download was actually
accepted; delete reopens the database and counts; a delete blocked by another open tab
fails loudly with that explanation rather than hanging.

---

## Speech: what it does and does not do

Speaking mode is **transcript similarity, never pronunciation assessment.** The browser
returns its best guess at the words and the app compares that text to the sentence. A low
score can mean you said it wrong — or that recognition mangled a perfectly good
Thai-accented sentence. Every label says "transcript", and **"Recognition misheard me"**
overrides the grade.

- The microphone stays **off until you explicitly enable it**, behind a panel that states
  the browser may send audio to an external service (in Chrome and Edge it does).
- **No audio is recorded, kept or uploaded** by this app. Only the text that comes back is
  used, and only the text is stored.
- Every failure path — unsupported browser, permission denied, no microphone, nothing
  heard, network error — falls back to self-assessed manual practice, which still earns
  XP. There is no dead end.

### Limitations

|                 |                                                                                                                                                                                                                        |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Recognition** | Chrome and Edge only. Firefox and Safari have no `SpeechRecognition`; the app detects this and goes straight to manual practice.                                                                                       |
| **Network**     | Chrome's recogniser is a cloud service, so Speaking does **not** work offline even though everything else does.                                                                                                        |
| **Voices**      | Text-to-speech uses whatever voices the operating system has. A machine with no Thai voice gets a disabled Replay button and a stated reason; Dictation reveals the sentence instead of leaving the card unanswerable. |
| **Accents**     | Recognition is trained on native speech and mishears accented English. That is why the override exists and why the score is never called a pronunciation assessment.                                                   |

**What automated tests cannot check.** `tests/e2e/speech.spec.ts` mocks the Web Speech API
to prove the app handles every event correctly, and `tests/unit/speech.test.ts` does the
same for the wrappers. Neither can prove that a real Chrome fires those events, that the
permission prompt appears, that a real microphone is picked up, or how your accent is
actually transcribed. **Those four need a human in a real browser.**

---

## Profiles, and what the passcode really does

Two people can share a laptop without sharing a schedule. Settings → **Profiles** adds
one; each gets **its own IndexedDB database**, so nothing is merged or filtered — the
separation is the database boundary itself. The first profile keeps the database the app
already had, so an existing learner is not migrated and notices nothing.

A profile can carry a numeric **passcode**. Be clear about what that buys you:

> It hides your progress from someone else using the same computer. It is **not
> encryption**. The data stays in IndexedDB in plain text, and anyone who opens the
> browser's developer tools — or reads an exported backup file — can see all of it
> without ever meeting the prompt.

The digits are still hashed (PBKDF2-SHA256, per-profile salt) and never written down as
typed. Not because that makes four digits hard to recover — nothing could — but because
people reuse PINs, and this one should not be sitting in storage ready to try somewhere
else. Unlocking lasts for the browser tab, so closing it re-locks.

Because nothing is encrypted, a **forgotten passcode can be removed** by typing the
profile name. Refusing would lock you out of your own progress while changing nothing
about who can read it.

This is emphatically **not an account system**. There is no server, no sign-up, no
password reset and nothing synced between devices. It is a picker on one browser.

|                              |                                                                             |
| ---------------------------- | --------------------------------------------------------------------------- |
| **Separates**                | Progress, schedules, XP, streaks, saved words, imported lessons             |
| **Protects against**         | Someone casually picking up your unlocked laptop                            |
| **Does not protect against** | Developer tools, reading a backup file, anyone with the device and a minute |
| **Does not do**              | Sync, sharing, remote access, recovery                                      |

---

## Privacy

- **No backend, no account, no analytics, no third-party requests.** The app is a static
  export; once loaded it talks to nothing.
- Everything lives in your browser's IndexedDB, on your device. Clearing site data erases
  it — which is what the backup export is for.
- Profile names and passcode hashes sit in `localStorage`; no learning data does. A
  backup exports the **active profile** only.
- The only data that can leave the device is what **you** send: audio the browser
  transcribes when you enable the microphone, and — if a future build registers an AI
  provider — the fields listed in Settings, after you have explicitly agreed.
- **No credential exists anywhere in this app**: not in the code, an environment variable,
  `localStorage`, IndexedDB or a commit.

---

## Optional AI, and how it would be enabled

AI is **off, and this build registers no provider at all.** Every feature works without
it. Full detail in [docs/ai.md](docs/ai.md).

`src/lib/ai` defines a typed `AIProvider` with seven capabilities — explaining a mistake
in Thai, generating a lesson or sentences, extracting vocabulary, translating, building a
gap-fill, and suggesting follow-ups. The default is a **real implementation that refuses
every call**, not a `null` callers must check for, so the AI paths run on every load and
no feature can quietly come to depend on AI being present.

Enabling one would take three things:

1. **A server-side adapter — not built here, deliberately.** This app is a static export:
   anything the browser holds is readable by anyone who opens the page, so a browser-side
   API key is not a risk to manage but a mistake to avoid entirely. The adapter holds the
   key in its own environment, exposes one plain endpoint per capability, and enforces its
   own rate limit and spending cap.
2. **One more `AIProvider` implementation** pointing at that endpoint's URL — a URL is not
   a secret — registered in `src/lib/ai/registry.ts`. That is the only change this app
   needs.
3. **Consent, twice.** A provider must be configured and switched on, **and**
   `ai.consentGivenAt` must be set. Turning AI on is not agreement to send content.
   Settings lists the literal values that would leave the device, generated from the
   request objects themselves so the disclosure cannot drift away from the payload.

Every response is validated with Zod before anything uses it — model output is untrusted
input. No AI schema can supply an IPA or a dictionary entry: **the word panel stays
hand-written only**, because a generated pronunciation would quietly break that promise.

---

## Further reading

| Document                                                       | Covers                                                     |
| -------------------------------------------------------------- | ---------------------------------------------------------- |
| [docs/answer-checking.md](docs/answer-checking.md)             | Normalization, edit distance, accuracy, bands              |
| [docs/spaced-repetition.md](docs/spaced-repetition.md)         | The scheduler in full                                      |
| [docs/metrics.md](docs/metrics.md)                             | How every dashboard figure is computed                     |
| [docs/import-export.md](docs/import-export.md)                 | Field defaults, separators, duplicate rules, backup format |
| [docs/pwa-and-accessibility.md](docs/pwa-and-accessibility.md) | Offline shell, contrast, focus, announcements              |
| [docs/ai.md](docs/ai.md)                                       | The provider interface, consent and validation             |
| [CLAUDE.md](CLAUDE.md)                                         | The rules that constrain changes to this codebase          |
