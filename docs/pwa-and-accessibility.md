# PWA and accessibility

## Installing and working offline

The app is a static export, so there is no runtime to keep it alive: everything offline
depends on the browser holding the files and the data.

**Data was already offline.** Sentences, progress, attempts and settings live in
IndexedDB, which does not care whether there is a network. The service worker's only job
is to make sure the app that reads them still loads.

### The precache list is generated, never hand-written

`npm run build` runs three steps:

```
next build                           # writes out/
node scripts/flatten-rsc-payloads.mjs
node scripts/generate-sw.mjs         # writes out/sw.js
```

`generate-sw.mjs` walks `out/`, turns each file into the URL it is actually requested at
(`out/lessons/index.html` → `/lessons/`), and injects that list into
`scripts/sw-template.js`. Chunk names are content hashes; a list typed by hand would be
wrong the first time a chunk changed, and **a shell missing one chunk is a shell that
does not open**.

The same walk produces a SHA-256 of the whole build, which becomes the cache name
(`engthai-shell-<hash>`). A rebuild therefore cannot reuse the previous cache, and
`activate` deletes every older one — there is no way to end up serving half of one build
and half of another.

### What the worker does with a request

| Request                   | Behaviour                                                             |
| ------------------------- | --------------------------------------------------------------------- |
| Navigation                | Network first, fall back to the precached document for that URL       |
| Navigation to unknown URL | Precached `404.html` **with a 404 status**, else a 503 offline notice |
| Static asset              | Cache first — the filenames are content-hashed, so a hit is correct   |
| Cross-origin, or non-GET  | Untouched                                                             |

Navigations go to the network first so a redeploy is picked up on the next load rather
than after a second visit. Assets go to the cache first because their names change
whenever their contents do.

The offline miss deliberately does **not** fall back to the dashboard. Answering "200,
here is a page" for a URL that does not exist is worse offline than online, because
there is nothing to correct the impression.

`cache.match` passes `ignoreVary: true` for assets. Precached entries were fetched
without the RSC headers `next/link` adds to client-side navigation requests, and a Vary
miss on those would quietly drop every link back to a full page load while offline.

### Development

Nothing is registered in development, and a worker left over from a production build on
the same origin is **unregistered** — a hot-reloading dev server is exactly the thing
that must not be cached.

### Icons

`scripts/generate-icons.mjs` draws the four PNGs from shapes (rounded rectangles, a
software rasterizer, a hand-rolled PNG encoder — no dependencies). Regenerate with
`npm run icons`. Drawing them rather than committing opaque binaries means a change to
the icon is a readable diff.

Everything sits inside the central 80% of the canvas, so the maskable variant survives
whatever shape Android crops it to.

## Accessibility

### Colour contrast is measured, not judged

`tests/unit/contrast.test.ts` parses the tokens straight out of `globals.css` and
computes the WCAG ratio for **every** pairing the UI can produce, in both themes: 4.5 for
anything carrying words, 3.0 for the accent where it is a fill or a focus ring, and 4.5
for text on the accent.

This found three real failures that had been in the app for several sessions — light
`muted`, `success` and `warning` were all under 4.5 on `surface-muted`, which is the
background behind badges and keyboard hints. All three were darkened. A token nudged for
looks now fails a test rather than someone's eyes.

### Keyboard focus

One global rule gives every interactive element a 2px accent outline on `:focus-visible`.
It is written with **element selectors rather than `:where()`** on purpose: several
inputs carry Tailwind's `outline-none`, and a zero-specificity selector would lose to it.
`tests/e2e/accessibility.spec.ts` asks the cascade directly which declaration wins, so
the rule cannot be silently out-specified later.

The skip link is the first tab stop, and it is genuinely visible when focused rather than
a one-pixel sliver.

### Answer feedback is announced

A grade is a coloured word, a percentage and a colour-coded diff. None of that reads
aloud, so `announceResult` (in `src/lib/answer`, pure and unit-tested) builds a sentence
carrying the same three facts: the verdict, the score, and **which words were actually
wrong** — missing, extra, or substituted, capped at three plus a count so one bad answer
is not read out for a minute. It adds the mode's caveats (transcript similarity, blanks
only) and the XP, and always states the expected answer on a miss.

The live region is **mounted for the whole session and empty until a grade arrives**. A
region inserted at the same moment as its text is routinely missed by screen readers.

### Layout

`tests/e2e/accessibility.spec.ts` measures `scrollWidth` on all seven screens at 320,
375 and 1280, and reports the widest offending element when it fails. Every screen has
exactly one `main` and one `h1`, and the current page carries `aria-current="page"`.

### Motion and sound

`prefers-reduced-motion: reduce` neutralises every animation and transition globally.
Feedback sounds are off unless the learner turns them on.
