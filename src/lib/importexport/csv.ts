/**
 * A small RFC 4180 CSV reader.
 *
 * Written by hand rather than pulled in as a dependency: the format is tiny, and the
 * parts that actually matter here — quoted fields containing commas or newlines, and
 * doubled quotes as an escape — are exactly the parts a naive `split(",")` gets wrong
 * and silently corrupts a learner's import with.
 */

const BOM = "﻿";

/** Splits CSV text into rows of raw string cells. Quotes are resolved, nothing is trimmed. */
export function parseCsv(text: string): string[][] {
  const input = text.startsWith(BOM) ? text.slice(1) : text;

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let fieldWasQuoted = false;

  const endField = () => {
    row.push(field);
    field = "";
    fieldWasQuoted = false;
  };

  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        // A doubled quote inside a quoted field is a literal quote.
        if (input[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && field.length === 0) {
      inQuotes = true;
      fieldWasQuoted = true;
      continue;
    }

    if (char === ",") {
      endField();
      continue;
    }

    if (char === "\r") {
      // Swallow CRLF as one break.
      if (input[i + 1] === "\n") i += 1;
      endRow();
      continue;
    }

    if (char === "\n") {
      endRow();
      continue;
    }

    field += char;
  }

  // A trailing newline leaves nothing pending; anything else is a final field.
  if (field.length > 0 || fieldWasQuoted || row.length > 0) endRow();

  // Drop rows that are entirely empty, which a trailing blank line produces.
  return rows.filter((cells) => cells.some((cell) => cell.trim().length > 0));
}

export type CsvTable = {
  /** Header names, lower-cased and trimmed. */
  headers: string[];
  /** One record per data row, keyed by header. Missing trailing cells read as "". */
  records: Record<string, string>[];
};

/**
 * Reads CSV with a header row.
 *
 * Headers are matched case-insensitively and with surrounding whitespace removed, so a
 * spreadsheet exporting `English ` still lines up with `english`.
 */
export function parseCsvTable(text: string): CsvTable {
  const rows = parseCsv(text);
  if (rows.length === 0) return { headers: [], records: [] };

  const headers = rows[0].map((h) => h.trim().toLowerCase());

  const records = rows.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (header.length === 0) return;
      record[header] = (cells[index] ?? "").trim();
    });
    return record;
  });

  return { headers, records };
}
