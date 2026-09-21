# Optional AI

AI is **off, and this build has no provider at all**. Every feature of EngThai Trainer
works without it, and nothing here is on the critical path of learning.

`src/lib/ai` is the abstraction that would make a provider possible later, plus the
guarantees that keep the app honest in the meantime.

## No credentials, anywhere

There is no API key in this codebase, in an environment variable, in `localStorage`, in
IndexedDB, or in a commit — and there is no place to put one.

**This is a static export with no server.** Anything the browser holds, the user (and
anyone else who opens the page) can read. A key in a public env var is baked into the
JavaScript bundle. A key in IndexedDB sits in plain text on disk _and_ gets copied into
every backup file. Neither is a mistake you can make carefully.

An earlier version of the settings schema had an `ai.apiKey` field. It is gone, and
**migration v5 strips it from any row that still has one**. A backup file carrying that
key is also harmless: `settingsSchema` does not declare the field, so Zod drops it when
the backup is validated, before a restore can write it back.

### What a real provider would require

A server-side adapter. Not built here, deliberately. It would need to:

1. Hold the API key in **its own** environment, never sent to the browser.
2. Expose a plain endpoint per capability, taking the typed request in this module and
   returning the typed response.
3. Enforce its own rate limiting and spending cap, since a public endpoint is a public
   endpoint.
4. Log nothing it does not need, given the payloads are a learner's own sentences.

The browser side would then be one more `AIProvider` implementation pointing at that
endpoint's URL — a URL is not a secret. Registering it in
`src/lib/ai/registry.ts` is the only change this app would need.

## The interface

`AIProvider` covers seven capabilities:

| Capability              | What it does                              |
| ----------------------- | ----------------------------------------- |
| `explainMistake`        | Explains in Thai why an answer was wrong  |
| `generateLesson`        | Writes a lesson on a topic                |
| `generateSentences`     | Writes practice sentences at a CEFR level |
| `extractVocabulary`     | Picks out the key words of a sentence     |
| `translate`             | Translates English into Thai              |
| `generateBlankExercise` | Turns a sentence into a gap-fill          |
| `followUpQuestions`     | Suggests follow-up questions              |

Every method returns an `AIResult` rather than throwing. Missing, offline, rate-limited
and talking-nonsense all surface the same way, so callers have exactly one path to handle
and no feature can be written that only works when AI happens to be present.

The default `disabledProvider` is a **real implementation that refuses every call**,
not a `null` that callers must check for. That means the AI paths are exercised on every
run, and a feature cannot quietly come to depend on AI being there.

## Consent

Two gates, both of which must be open before anything leaves the device:

1. A provider is configured **and** AI is switched on.
2. The learner has explicitly agreed, recorded as `ai.consentGivenAt`.

Turning AI on is **not** agreement to send content. `runCapability` checks consent
_before_ building a request, so a refusal means nothing was transmitted — not that it was
transmitted and discarded.

Settings shows exactly what would be sent, field by field, with the literal values. The
disclosure is generated from the request objects themselves (`describeRequest`) rather
than written out by hand, so it cannot drift away from the payload: a new request field
that nobody discloses shows up in the tests, not in someone's network log.

`NEVER_SENT` states the other half positively — no answer history, no settings, no
identifier, no whole-library upload, and never any audio.

## Validating what comes back

Model output is **untrusted input**, no different from a pasted file: it can be
truncated, wrapped in prose, or confidently wrong about its own shape.

`validateResponse` parses every response against a Zod schema before anything uses it,
and `runCapability` applies it even when the provider's TypeScript types already claim
the right shape — the type is a promise, the schema is a check. A failure returns
`invalid-response` with the exact paths that were wrong, capped at ten so one broken
payload cannot flood the screen.

`extractJson` handles the practical reality that models answer with
`Sure! ```json …``` ` — it takes the first balanced object or array and lets the schema
decide whether it is usable.

Note what the schemas deliberately **cannot** express: no AI response may supply an IPA
pronunciation or a curated dictionary entry. The word panel shows hand-written data only,
and a generated pronunciation would quietly break that promise.
