import { normalizeEnglish } from "@/lib/answer";
import { lessonImportRowSchema, type LessonImportRow } from "./schema";
import type { RawRow, SourceResult } from "./sources";

export type DuplicateOf = { kind: "existing"; sentenceId: string } | { kind: "file"; line: number };

export type PlannedRow = {
  line: number;
  row: LessonImportRow;
  /** Set when this row matches something already stored or an earlier row in the file. */
  duplicateOf?: DuplicateOf;
  /** Accepted, but something was dropped or assumed. */
  warnings: string[];
};

export type RejectedRow = {
  line: number;
  errors: string[];
};

export type ImportPlan = {
  fatal?: string;
  /** Rows that would be written as new sentences. */
  create: PlannedRow[];
  /** Rows matching an existing sentence. Written only when the mode says so. */
  duplicates: PlannedRow[];
  rejected: RejectedRow[];
  /** Every valid row, in file order, for the preview table. */
  accepted: PlannedRow[];
};

export type DuplicateMode = "skip" | "update";

/** Existing sentences, reduced to what duplicate detection needs. */
export type ExistingSentence = { id: string; en: string };

function describeIssues(error: { issues: { path: PropertyKey[]; message: string }[] }): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".");
    return path.length > 0 ? `${path}: ${issue.message}` : issue.message;
  });
}

function warningsFor(row: LessonImportRow, readerNotes: string[] = []): string[] {
  const warnings = [...readerNotes];

  if (row.examples.length > 1) {
    warnings.push(`only the first of ${row.examples.length} examples is stored`);
  }

  return warnings;
}

/**
 * Turns parsed rows into a plan, without touching the database.
 *
 * Duplicates are matched on **normalized English**, using the same normalizer the answer
 * checker uses — so "Where are you going?" and "where are you going" are one sentence,
 * exactly as they would be when grading.
 *
 * Both directions of duplication are detected: against what is already stored, and
 * against earlier rows in the same file. The second matters because a file that repeats
 * itself would otherwise create two sentences that can never be told apart.
 */
export function buildImportPlan(source: SourceResult, existing: ExistingSentence[]): ImportPlan {
  const empty: ImportPlan = { create: [], duplicates: [], rejected: [], accepted: [] };

  if (source.fatal) return { ...empty, fatal: source.fatal };

  const byNormalized = new Map<string, string>();
  for (const sentence of existing) {
    const key = normalizeEnglish(sentence.en);
    if (!byNormalized.has(key)) byNormalized.set(key, sentence.id);
  }

  const seenInFile = new Map<string, number>();
  const plan: ImportPlan = { create: [], duplicates: [], rejected: [], accepted: [] };

  for (const raw of source.rows as RawRow[]) {
    const parsed = lessonImportRowSchema.safeParse(raw.value);

    if (!parsed.success) {
      plan.rejected.push({ line: raw.line, errors: describeIssues(parsed.error) });
      continue;
    }

    const row = parsed.data;
    const key = normalizeEnglish(row.english);

    const planned: PlannedRow = { line: raw.line, row, warnings: warningsFor(row, raw.notes) };

    const existingId = byNormalized.get(key);
    const earlierLine = seenInFile.get(key);

    if (existingId !== undefined) {
      planned.duplicateOf = { kind: "existing", sentenceId: existingId };
      plan.duplicates.push(planned);
    } else if (earlierLine !== undefined) {
      planned.duplicateOf = { kind: "file", line: earlierLine };
      plan.duplicates.push(planned);
    } else {
      seenInFile.set(key, raw.line);
      plan.create.push(planned);
    }

    plan.accepted.push(planned);
  }

  return plan;
}

export type PlanSummary = {
  total: number;
  create: number;
  duplicates: number;
  rejected: number;
  warnings: number;
  /** How many rows a run in this mode would actually write. */
  willWrite: number;
};

export function summarize(plan: ImportPlan, mode: DuplicateMode): PlanSummary {
  // A duplicate of an earlier row in the same file is never written, whatever the mode:
  // there is no distinct existing sentence to update.
  const updatable = plan.duplicates.filter((d) => d.duplicateOf?.kind === "existing").length;

  return {
    total: plan.accepted.length + plan.rejected.length,
    create: plan.create.length,
    duplicates: plan.duplicates.length,
    rejected: plan.rejected.length,
    warnings: plan.accepted.reduce((n, row) => n + row.warnings.length, 0),
    willWrite: plan.create.length + (mode === "update" ? updatable : 0),
  };
}
