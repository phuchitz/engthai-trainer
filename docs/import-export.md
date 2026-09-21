# Import, export and backup

Two separate flows, deliberately kept apart on the Import / Export screen:

- **Import lessons** adds sentences to what you already have.
- **Backup & restore** replaces everything, and carries your learning history.

Mixing them would make it far too easy to wipe a month of progress while meaning to add
ten sentences.

## Lesson import

### Required and optional fields

Required: **`english`** and **`thai`**. Everything else is optional, and these are the
defaults:

| Field                | Default  | Notes                                               |
| -------------------- | -------- | --------------------------------------------------- |
| `level`              | `A1`     | One of `A1`, `A2`, `B1`, `B2`, `C1`                 |
| `category`           | `custom` | Imported material is yours until you move it        |
| `acceptedAnswers`    | `[]`     | Extra English answers that also count as correct    |
| `vocabulary`         | `[]`     | Each item needs **both** an English and a Thai side |
| `grammarExplanation` | _none_   | Shown after grading                                 |
| `examples`           | _none_   | Only the **first** is stored; extras warn           |
| `transliteration`    | _none_   |                                                     |
| `hint`               | _none_   |                                                     |

A vocabulary item with no Thai side is **dropped with a warning**, never stored with a
blank meaning: the word panel shows only hand-written data, and a half-empty entry would
be worse than none at all.

### JSON

An array of objects, or an object with a `sentences` (or `rows`) array:

```json
[
  {
    "english": "Let's deploy this after the review.",
    "thai": "ดีพลอยตัวนี้หลังรีวิวเสร็จแล้วกัน",
    "level": "B1",
    "category": "software",
    "acceptedAnswers": ["Let us deploy this after the review."],
    "vocabulary": [{ "en": "deploy", "th": "ดีพลอย" }],
    "grammarExplanation": "Let's ย่อมาจาก Let us",
    "examples": [{ "en": "Let's merge this tomorrow.", "th": "พรุ่งนี้ค่อยเมิร์จตัวนี้กัน" }]
  }
]
```

In JSON, a malformed `vocabulary` entry **rejects the row**, with the exact path in the
error. JSON is machine-written, so a broken object there is a real bug rather than a typo.

### CSV

A header row is required and must include an `english` and a `thai` column. Headers are
matched case-insensitively and trimmed; `en`/`th`/`sentence`/`translation` are accepted
aliases.

```csv
english,thai,level,category,acceptedAnswers,vocabulary,examples
Good morning,อรุณสวัสดิ์,A1,daily,,,
"Let's go, then",ไปกันเถอะ,A2,daily,"Let us go;Shall we go","go=ไป","Let's eat=กินกันเถอะ"
```

- Quoted fields may contain **commas, newlines and doubled quotes** (`""` for a literal `"`).
- A byte order mark and CRLF line endings are handled.
- Multi-value cells separate items with **`;`**.
- A `vocabulary` or `examples` item pairs its two sides with **`=`**, as `en=th`.
- In CSV, a malformed `en=th` pair is **dropped with a warning** rather than failing the
  row: list cells are hand-typed, so a typo should not cost you the sentence.

### Pasted pairs

One pair per line, the two sides separated by a **tab** or a **`|`**:

```
Good morning | อรุณสวัสดิ์
See you tomorrow	แล้วเจอกันพรุ่งนี้
# lines starting with a hash are ignored
```

Tab is checked first, because pasting two spreadsheet columns is the common case and Thai
text never contains one. Blank lines and `#` comments are skipped. A line with no
separator is reported against **its own line number** rather than failing the whole paste.

### Preview, duplicates and what gets written

Nothing is written until you press the import button. The preview shows every row with
its line number and one of three states, plus any warnings.

**Duplicates are matched on normalized English**, using the same normalizer the answer
checker uses — so `Where are you going?` and `where are you going` are one sentence,
exactly as they would be when grading. The Thai side is not part of the match: the
English is the identity.

Two kinds are detected:

- **Already in your library** — matches a stored sentence.
- **Repeat of line N** — matches an earlier row in the same file. Only the first is kept,
  because two identical sentences could never be told apart afterwards.

The default is **skip**. Choosing **update existing** rewrites the stored sentence's
content while **reusing its id**, which is what preserves learning history: progress rows
and attempts key on that id, so the schedule and the answer log stay exactly where they
were. An in-file repeat is never written in either mode — there is no distinct sentence
to update.

## Backup and restore

A backup is a complete, self-describing snapshot: content **and** learning history —
sentences, vocabulary, lessons, progress, attempts, sessions and settings.

```json
{
  "format": "engthai-trainer-backup",
  "formatVersion": 1,
  "exportedAt": 1758000000000,
  "appDbVersion": 4,
  "data": { "lessons": [], "sentences": [], "…": [] }
}
```

`formatVersion` is deliberately **separate from the IndexedDB `DB_VERSION`**. The database
version describes the shape on this device; the format version describes the file, and a
file has to stay readable long after the schema behind it has moved on. A backup from a
_newer_ format version is refused rather than half-understood.

Restore **validates the entire file before touching anything**, then clears and rewrites
every store in one transaction. A half-valid file is rejected outright: a partial write
would leave neither the old data nor a working copy of the new. Restore replaces rather
than merges, so anything added since the backup is gone.

## Delete all data

Offers a backup first, and requires typing `DELETE` exactly. Afterwards the database is
**reopened and counted** — a delete that silently failed is reported as a failure, never
as success. The same rule applies to export and import: nothing claims to have worked
unless the write actually returned.
