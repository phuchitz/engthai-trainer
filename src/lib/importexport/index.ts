export { parseCsv, parseCsvTable } from "./csv";
export type { CsvTable } from "./csv";

export {
  lessonImportRowSchema,
  importVocabularySchema,
  importExampleSchema,
  IMPORT_DEFAULT_LEVEL,
  IMPORT_DEFAULT_CATEGORY,
} from "./schema";
export type { LessonImportRow, LessonImportInput } from "./schema";

export {
  readSource,
  readJsonSource,
  readCsvSource,
  readPasteSource,
  LIST_SEPARATOR,
  PAIR_SEPARATOR,
  PASTE_SEPARATORS,
} from "./sources";
export type { SourceFormat, SourceResult, RawRow } from "./sources";

export { buildImportPlan, summarize } from "./plan";
export type {
  ImportPlan,
  PlannedRow,
  RejectedRow,
  PlanSummary,
  DuplicateMode,
  ExistingSentence,
} from "./plan";

export { applyImportPlan, loadExistingForDuplicates } from "./apply";
export type { ImportResult } from "./apply";

export {
  createBackup,
  serializeBackup,
  inspectBackup,
  restoreBackup,
  deleteAllData,
  backupFilename,
  backupSchema,
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
} from "./backup";
export type { Backup, BackupInspection, DeleteResult } from "./backup";
