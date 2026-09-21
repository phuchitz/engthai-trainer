import { parseCsvTable } from "./csv";
import { lessonImportFileSchema } from "./schema";

export type SourceFormat = "json" | "csv" | "paste";

export type RawRow = {
  /** 1-based, as the learner sees it in their file. */
  line: number;
  value: unknown;
  /**
   * Things the reader itself had to decide, which the preview should surface.
   *
   * A list cell is hand-typed, so a malformed `en=th` pair is dropped rather than
   * failing the whole sentence — but it is never dropped silently.
   */
  notes?: string[];
};

export type SourceResult = {
  rows: RawRow[];
  /** A problem with the file as a whole, e.g. malformed JSON. Nothing is importable. */
  fatal?: string;
};

/** Multi-value cells in CSV and pasted text use a semicolon. */
export const LIST_SEPARATOR = ";";

/** A vocabulary pair inside a list cell: `deploy=ดีพลอย`. */
export const PAIR_SEPARATOR = "=";

/**
 * Pasted lines use a tab or a pipe between the two sides.
 *
 * Tab first, because pasting two spreadsheet columns is the common case and Thai text
 * never contains one. A pipe is the typed-by-hand alternative.
 */
export const PASTE_SEPARATORS = ["\t", "|"] as const;

function splitList(value: string): string[] {
  return value
    .split(LIST_SEPARATOR)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function parsePairs(value: string): { pairs: { en: string; th: string }[]; dropped: number } {
  const items = splitList(value);
  const pairs: { en: string; th: string }[] = [];
  let dropped = 0;

  for (const item of items) {
    const index = item.indexOf(PAIR_SEPARATOR);
    const en = index < 0 ? "" : item.slice(0, index).trim();
    const th = index < 0 ? "" : item.slice(index + 1).trim();
    if (en.length === 0 || th.length === 0) {
      dropped += 1;
      continue;
    }
    pairs.push({ en, th });
  }

  return { pairs, dropped };
}

function parseExamples(value: string): { en: string; th?: string }[] {
  return splitList(value).map((item) => {
    const index = item.indexOf(PAIR_SEPARATOR);
    if (index < 0) return { en: item };
    return { en: item.slice(0, index).trim(), th: item.slice(index + 1).trim() || undefined };
  });
}

/** Turns a CSV record into the loose shape the row schema validates, plus any notes. */
function fromCsvRecord(record: Record<string, string>): { value: Record<string, unknown>; notes: string[] } {
  const notes: string[] = [];
  const pick = (...names: string[]) => {
    for (const name of names) {
      const value = record[name];
      if (value !== undefined && value.length > 0) return value;
    }
    return undefined;
  };

  const row: Record<string, unknown> = {
    english: pick("english", "en", "sentence"),
    thai: pick("thai", "th", "translation"),
  };

  const level = pick("level");
  if (level) row.level = level.toUpperCase();

  const category = pick("category");
  if (category) row.category = category.toLowerCase();

  const accepted = pick("acceptedanswers", "accepted_answers", "alternates");
  if (accepted) row.acceptedAnswers = splitList(accepted);

  const vocabulary = pick("vocabulary", "vocab");
  if (vocabulary) {
    const { pairs, dropped } = parsePairs(vocabulary);
    row.vocabulary = pairs;
    if (dropped > 0) {
      notes.push(
        `${dropped} vocabulary item(s) skipped: each needs an English and a Thai side, written as en${PAIR_SEPARATOR}th`,
      );
    }
  }

  const grammar = pick("grammarexplanation", "grammar_explanation", "grammar", "notes");
  if (grammar) row.grammarExplanation = grammar;

  const examples = pick("examples", "example");
  if (examples) row.examples = parseExamples(examples);

  const transliteration = pick("transliteration");
  if (transliteration) row.transliteration = transliteration;

  const hint = pick("hint");
  if (hint) row.hint = hint;

  return { value: row, notes };
}

export function readJsonSource(text: string): SourceResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return { rows: [], fatal: `That is not valid JSON: ${(error as Error).message}` };
  }

  const shaped = lessonImportFileSchema.safeParse(parsed);
  if (!shaped.success) {
    return {
      rows: [],
      fatal: "Expected an array of sentences, or an object with a `sentences` array.",
    };
  }

  return { rows: shaped.data.map((value, index) => ({ line: index + 1, value })) };
}

export function readCsvSource(text: string): SourceResult {
  const table = parseCsvTable(text);

  if (table.headers.length === 0) return { rows: [], fatal: "The file is empty." };

  const hasEnglish = table.headers.some((h) => ["english", "en", "sentence"].includes(h));
  const hasThai = table.headers.some((h) => ["thai", "th", "translation"].includes(h));
  if (!hasEnglish || !hasThai) {
    return {
      rows: [],
      fatal: `The header row needs an "english" and a "thai" column. Found: ${table.headers.join(", ")}`,
    };
  }

  // Line 1 is the header, so the first record is line 2.
  return {
    rows: table.records.map((record, index) => {
      const { value, notes } = fromCsvRecord(record);
      return { line: index + 2, value, notes };
    }),
  };
}

/**
 * Reads pasted English–Thai pairs, one per line.
 *
 * Blank lines and lines starting with `#` are ignored, so a pasted block can carry
 * comments. A line with no separator is reported against its own line number rather
 * than failing the whole paste.
 */
export function readPasteSource(text: string): SourceResult {
  const rows: RawRow[] = [];

  text.split(/\r?\n/).forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) return;

    const separator = PASTE_SEPARATORS.find((candidate) => line.includes(candidate));
    if (!separator) {
      // Handed on as-is: the row schema reports the missing Thai side against this line.
      rows.push({ line: index + 1, value: { english: line, thai: "" } });
      return;
    }

    const at = line.indexOf(separator);
    rows.push({
      line: index + 1,
      value: { english: line.slice(0, at).trim(), thai: line.slice(at + 1).trim() },
    });
  });

  if (rows.length === 0) return { rows: [], fatal: "Nothing to import." };
  return { rows };
}

export function readSource(format: SourceFormat, text: string): SourceResult {
  if (text.trim().length === 0) return { rows: [], fatal: "Nothing to import." };
  if (format === "json") return readJsonSource(text);
  if (format === "csv") return readCsvSource(text);
  return readPasteSource(text);
}
