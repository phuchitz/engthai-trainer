import { describe, it, expect } from "vitest";
import { buildImportPlan, readCsvSource, readPasteSource, summarize } from "@/lib/importexport";
import type { ExistingSentence, SourceResult } from "@/lib/importexport";

const EXISTING: ExistingSentence[] = [
  { id: "s-existing", en: "Where are you going?" },
  { id: "s-hungry", en: "I am very hungry." },
];

const source = (rows: unknown[]): SourceResult => ({
  rows: rows.map((value, index) => ({ line: index + 1, value })),
});

describe("buildImportPlan — validation", () => {
  it("accepts a valid row", () => {
    const plan = buildImportPlan(source([{ english: "Good morning", thai: "อรุณสวัสดิ์" }]), []);
    expect(plan.create).toHaveLength(1);
    expect(plan.rejected).toHaveLength(0);
  });

  it("rejects an invalid row against its own line number", () => {
    const plan = buildImportPlan(source([{ english: "ok", thai: "โอเค" }, { english: "missing thai" }]), []);
    expect(plan.create).toHaveLength(1);
    expect(plan.rejected).toEqual([
      { line: 2, errors: expect.arrayContaining([expect.stringContaining("thai")]) },
    ]);
  });

  it("keeps going after a bad row rather than failing the whole file", () => {
    const plan = buildImportPlan(
      source([{ english: "a", thai: "ก" }, { english: "" }, { english: "c", thai: "ค" }]),
      [],
    );
    expect(plan.create.map((r) => r.line)).toEqual([1, 3]);
    expect(plan.rejected.map((r) => r.line)).toEqual([2]);
  });

  it("passes a fatal source error straight through", () => {
    const plan = buildImportPlan({ rows: [], fatal: "That is not valid JSON" }, []);
    expect(plan.fatal).toBe("That is not valid JSON");
    expect(plan.create).toHaveLength(0);
  });
});

describe("buildImportPlan — duplicates against existing data", () => {
  it("flags an exact match", () => {
    const plan = buildImportPlan(source([{ english: "Where are you going?", thai: "คุณจะไปไหน" }]), EXISTING);
    expect(plan.create).toHaveLength(0);
    expect(plan.duplicates[0].duplicateOf).toEqual({ kind: "existing", sentenceId: "s-existing" });
  });

  it("matches on normalized English, so case and punctuation do not hide a duplicate", () => {
    const plan = buildImportPlan(
      source([{ english: "  where are you GOING  ", thai: "คุณจะไปไหน" }]),
      EXISTING,
    );
    expect(plan.duplicates).toHaveLength(1);
    expect(plan.create).toHaveLength(0);
  });

  it("does not flag a genuinely different sentence", () => {
    const plan = buildImportPlan(source([{ english: "Where are you from?", thai: "คุณมาจากไหน" }]), EXISTING);
    expect(plan.create).toHaveLength(1);
    expect(plan.duplicates).toHaveLength(0);
  });

  it("ignores the Thai side when matching, since English is the identity here", () => {
    const plan = buildImportPlan(source([{ english: "Where are you going?", thai: "แปลอีกแบบ" }]), EXISTING);
    expect(plan.duplicates).toHaveLength(1);
  });
});

describe("buildImportPlan — duplicates within the file", () => {
  it("flags a repeat and points at the earlier line", () => {
    const plan = buildImportPlan(
      source([
        { english: "Good morning", thai: "อรุณสวัสดิ์" },
        { english: "good morning", thai: "สวัสดีตอนเช้า" },
      ]),
      [],
    );
    expect(plan.create).toHaveLength(1);
    expect(plan.duplicates[0].duplicateOf).toEqual({ kind: "file", line: 1 });
  });

  it("keeps only the first of three repeats", () => {
    const rows = [1, 2, 3].map(() => ({ english: "Hello", thai: "สวัสดี" }));
    const plan = buildImportPlan(source(rows), []);
    expect(plan.create).toHaveLength(1);
    expect(plan.duplicates).toHaveLength(2);
  });

  it("prefers the existing-data match when a row duplicates both", () => {
    const plan = buildImportPlan(
      source([
        { english: "Where are you going?", thai: "ก" },
        { english: "Where are you going?", thai: "ข" },
      ]),
      EXISTING,
    );
    expect(plan.duplicates.every((d) => d.duplicateOf?.kind === "existing")).toBe(true);
  });
});

describe("buildImportPlan — warnings", () => {
  it("warns when extra examples are dropped", () => {
    const plan = buildImportPlan(
      source([{ english: "a", thai: "ก", examples: [{ en: "one" }, { en: "two" }] }]),
      [],
    );
    expect(plan.create[0].warnings[0]).toMatch(/only the first of 2 examples/);
  });

  it("does not warn for a single example", () => {
    const plan = buildImportPlan(source([{ english: "a", thai: "ก", examples: [{ en: "one" }] }]), []);
    expect(plan.create[0].warnings).toEqual([]);
  });

  it("warns when a vocabulary item was dropped for missing a side", () => {
    // The CSV reader drops the half-written pair; the plan says so out loud.
    const result = readCsvSource('english,thai,vocabulary\na,ก,"deploy;review=รีวิว"');
    const plan = buildImportPlan(result, []);
    expect(plan.create[0].warnings[0]).toMatch(/1 vocabulary item\(s\) skipped/);
  });
});

describe("summarize", () => {
  const plan = buildImportPlan(
    source([
      { english: "Brand new", thai: "ใหม่" },
      { english: "Where are you going?", thai: "คุณจะไปไหน" },
      { english: "Brand new", thai: "ซ้ำ" },
      { english: "no thai here" },
    ]),
    EXISTING,
  );

  it("counts each category", () => {
    const summary = summarize(plan, "skip");
    expect(summary.total).toBe(4);
    expect(summary.create).toBe(1);
    expect(summary.duplicates).toBe(2);
    expect(summary.rejected).toBe(1);
  });

  it("writes only new rows when skipping duplicates", () => {
    expect(summarize(plan, "skip").willWrite).toBe(1);
  });

  it("writes the existing-data duplicate too when updating", () => {
    // The in-file repeat is still not written: there is no distinct sentence to update.
    expect(summarize(plan, "update").willWrite).toBe(2);
  });
});

describe("end-to-end through a pasted block", () => {
  it("plans a realistic paste", () => {
    const pasted = [
      "# my words",
      "Good morning | อรุณสวัสดิ์",
      "Where are you going? | คุณจะไปไหน",
      "broken line",
    ].join("\n");

    const plan = buildImportPlan(readPasteSource(pasted), EXISTING);

    expect(plan.create.map((r) => r.row.english)).toEqual(["Good morning"]);
    expect(plan.duplicates).toHaveLength(1);
    expect(plan.rejected.map((r) => r.line)).toEqual([4]);
  });
});
