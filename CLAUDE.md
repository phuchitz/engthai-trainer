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

## Data

Eight IndexedDB stores: `lessons`, `sentences`, `vocab`, `progress`, `attempts`,
`sessions`, `settings`, `meta`. `progress` is keyed per *(item, direction)* so the two
directions schedule independently. `attempts` is append-only — every dashboard figure
is derived from it, never from a stored counter.

Migrations are a fall-through ladder (`if (oldVersion < N)`, no `else`) in
`lib/db/migrations/`, each one a named, separately tested function.

## Commands

```
npm run check   # typecheck + lint + unit + build
npm run dev     # dev server
npm run e2e     # Playwright against the static export
```
