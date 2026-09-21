import { describe, it, expect } from "vitest";
import {
  parseCsv,
  parseCsvTable,
  readCsvSource,
  readJsonSource,
  readPasteSource,
  readSource,
  lessonImportRowSchema,
  IMPORT_DEFAULT_CATEGORY,
  IMPORT_DEFAULT_LEVEL,
} from "@/lib/importexport";

describe("parseCsv", () => {
  it("reads a plain table", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("keeps a comma inside a quoted field", () => {
    expect(parseCsv('a,b\n"one, two",three')).toEqual([
      ["a", "b"],
      ["one, two", "three"],
    ]);
  });

  it("unescapes a doubled quote", () => {
    expect(parseCsv('a\n"she said ""hi"""')).toEqual([["a"], ['she said "hi"']]);
  });

  it("keeps a newline inside a quoted field", () => {
    expect(parseCsv('a,b\n"line one\nline two",x')).toEqual([
      ["a", "b"],
      ["line one\nline two", "x"],
    ]);
  });

  it("handles CRLF line endings", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("strips a byte order mark", () => {
    expect(parseCsv("﻿a,b\n1,2")[0]).toEqual(["a", "b"]);
  });

  it("keeps empty cells in the middle of a row", () => {
    expect(parseCsv("a,b,c\n1,,3")).toEqual([
      ["a", "b", "c"],
      ["1", "", "3"],
    ]);
  });

  it("ignores a trailing blank line", () => {
    expect(parseCsv("a\n1\n\n")).toEqual([["a"], ["1"]]);
  });

  it("returns nothing for empty text", () => {
    expect(parseCsv("")).toEqual([]);
  });

  it("keeps Thai text intact", () => {
    expect(parseCsv("en,th\nhello,สวัสดี")[1]).toEqual(["hello", "สวัสดี"]);
  });
});

describe("parseCsvTable", () => {
  it("lower-cases and trims headers", () => {
    expect(parseCsvTable(" English , Thai \nhi,สวัสดี").headers).toEqual(["english", "thai"]);
  });

  it("keys records by header", () => {
    expect(parseCsvTable("english,thai\nhi,สวัสดี").records[0]).toEqual({
      english: "hi",
      thai: "สวัสดี",
    });
  });

  it("reads a missing trailing cell as empty", () => {
    expect(parseCsvTable("english,thai,level\nhi,สวัสดี").records[0].level).toBe("");
  });
});

describe("readJsonSource", () => {
  it("accepts a bare array", () => {
    const result = readJsonSource('[{"english":"hi","thai":"สวัสดี"}]');
    expect(result.fatal).toBeUndefined();
    expect(result.rows).toHaveLength(1);
  });

  it("accepts an object with a sentences array", () => {
    expect(readJsonSource('{"sentences":[{"english":"hi","thai":"สวัสดี"}]}').rows).toHaveLength(1);
  });

  it("reports malformed JSON as fatal", () => {
    expect(readJsonSource("{nope").fatal).toMatch(/not valid JSON/);
  });

  it("rejects a shape that is neither", () => {
    expect(readJsonSource('{"foo":1}').fatal).toMatch(/array of sentences/);
  });
});

describe("readCsvSource", () => {
  it("requires english and thai columns", () => {
    expect(readCsvSource("foo,bar\n1,2").fatal).toMatch(/needs an "english" and a "thai" column/);
  });

  it("accepts en/th aliases", () => {
    expect(readCsvSource("en,th\nhi,สวัสดี").fatal).toBeUndefined();
  });

  it("numbers rows from line 2, because line 1 is the header", () => {
    expect(readCsvSource("english,thai\nhi,สวัสดี\nbye,ลาก่อน").rows.map((r) => r.line)).toEqual([2, 3]);
  });

  it("splits a semicolon list into accepted answers", () => {
    const row = readCsvSource('english,thai,acceptedanswers\nhi,สวัสดี,"hello;hey"').rows[0].value;
    expect(row).toMatchObject({ acceptedAnswers: ["hello", "hey"] });
  });

  it("splits vocabulary pairs on the equals sign", () => {
    const row = readCsvSource('english,thai,vocabulary\nhi,สวัสดี,"deploy=ดีพลอย;review=รีวิว"').rows[0]
      .value;
    expect(row).toMatchObject({
      vocabulary: [
        { en: "deploy", th: "ดีพลอย" },
        { en: "review", th: "รีวิว" },
      ],
    });
  });

  it("drops a vocabulary item with no Thai side rather than inventing one", () => {
    const row = readCsvSource('english,thai,vocabulary\nhi,สวัสดี,"deploy;review=รีวิว"').rows[0].value;
    expect(row).toMatchObject({ vocabulary: [{ en: "review", th: "รีวิว" }] });
  });

  it("reads an example with both sides", () => {
    const row = readCsvSource('english,thai,examples\nhi,สวัสดี,"Hello there=สวัสดีจ้า"').rows[0].value;
    expect(row).toMatchObject({ examples: [{ en: "Hello there", th: "สวัสดีจ้า" }] });
  });

  it("uppercases a level and lowercases a category", () => {
    const row = readCsvSource("english,thai,level,category\nhi,สวัสดี,b1,SOFTWARE").rows[0].value;
    expect(row).toMatchObject({ level: "B1", category: "software" });
  });
});

describe("readPasteSource", () => {
  it("splits on a pipe", () => {
    expect(readPasteSource("hello | สวัสดี").rows[0].value).toEqual({
      english: "hello",
      thai: "สวัสดี",
    });
  });

  it("splits on a tab, which is what a spreadsheet paste produces", () => {
    expect(readPasteSource("hello\tสวัสดี").rows[0].value).toEqual({
      english: "hello",
      thai: "สวัสดี",
    });
  });

  it("prefers the tab when a line has both", () => {
    expect(readPasteSource("a|b\tสวัสดี").rows[0].value).toEqual({ english: "a|b", thai: "สวัสดี" });
  });

  it("ignores blank lines and comments", () => {
    const result = readPasteSource("# a note\n\nhello | สวัสดี\n\n");
    expect(result.rows).toHaveLength(1);
  });

  it("reports line numbers as the learner sees them", () => {
    const result = readPasteSource("# note\nhello | สวัสดี\nbye | ลาก่อน");
    expect(result.rows.map((r) => r.line)).toEqual([2, 3]);
  });

  it("keeps a separator-less line so it fails against its own line number", () => {
    const result = readPasteSource("hello | สวัสดี\njust english");
    expect(result.rows[1]).toEqual({ line: 2, value: { english: "just english", thai: "" } });
  });

  it("is fatal only when there is nothing at all", () => {
    expect(readPasteSource("   \n\n").fatal).toBe("Nothing to import.");
  });
});

describe("readSource", () => {
  it("dispatches on format", () => {
    expect(readSource("json", '[{"english":"a","thai":"ก"}]').rows).toHaveLength(1);
    expect(readSource("csv", "english,thai\na,ก").rows).toHaveLength(1);
    expect(readSource("paste", "a | ก").rows).toHaveLength(1);
  });

  it("treats empty input as fatal whatever the format", () => {
    for (const format of ["json", "csv", "paste"] as const) {
      expect(readSource(format, "  ").fatal).toBe("Nothing to import.");
    }
  });
});

describe("lessonImportRowSchema", () => {
  it("applies the documented defaults", () => {
    const row = lessonImportRowSchema.parse({ english: "hi", thai: "สวัสดี" });
    expect(row.level).toBe(IMPORT_DEFAULT_LEVEL);
    expect(row.category).toBe(IMPORT_DEFAULT_CATEGORY);
    expect(row.acceptedAnswers).toEqual([]);
    expect(row.vocabulary).toEqual([]);
    expect(row.examples).toEqual([]);
    expect(row.grammarExplanation).toBeUndefined();
  });

  it("requires both sides", () => {
    expect(lessonImportRowSchema.safeParse({ english: "hi", thai: "" }).success).toBe(false);
    expect(lessonImportRowSchema.safeParse({ english: "", thai: "สวัสดี" }).success).toBe(false);
    expect(lessonImportRowSchema.safeParse({ thai: "สวัสดี" }).success).toBe(false);
  });

  it("trims surrounding whitespace", () => {
    expect(lessonImportRowSchema.parse({ english: "  hi  ", thai: " สวัสดี " }).english).toBe("hi");
  });

  it("rejects an unknown level or category", () => {
    expect(lessonImportRowSchema.safeParse({ english: "a", thai: "ก", level: "Z9" }).success).toBe(false);
    expect(lessonImportRowSchema.safeParse({ english: "a", thai: "ก", category: "nope" }).success).toBe(
      false,
    );
  });

  it("rejects a vocabulary item missing its Thai side", () => {
    const result = lessonImportRowSchema.safeParse({
      english: "a",
      thai: "ก",
      vocabulary: [{ en: "deploy" }],
    });
    expect(result.success).toBe(false);
  });

  it("names the offending field in its error", () => {
    const result = lessonImportRowSchema.safeParse({ english: "a", thai: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("thai");
    }
  });
});
