import type { DBSchema } from "idb";
import type {
  Attempt,
  Lesson,
  Sentence,
  SentenceProgress,
  Settings,
  StudySession,
  VocabularyEntry,
} from "@/lib/models";

export const DB_NAME = "engthai-trainer";

/** Bump together with a new entry in lib/db/migrations. */
export const DB_VERSION = 6;

export type MetaRecord = {
  key: string;
  value: unknown;
};

export interface EngThaiDB extends DBSchema {
  lessons: {
    key: string;
    value: Lesson;
    indexes: { "by-level": string; "by-source": string };
  };
  sentences: {
    key: string;
    value: Sentence;
    indexes: {
      "by-level": string;
      "by-source": string;
      "by-tag": string;
      "by-lesson": string;
      "by-category": string;
    };
  };
  vocab: {
    key: string;
    value: VocabularyEntry;
    indexes: { "by-en": string; "by-th": string; "by-source": string };
  };
  progress: {
    key: string;
    value: SentenceProgress;
    indexes: {
      "by-item": [string, string];
      "by-due": [string, number];
      "by-next-review": number;
    };
  };
  attempts: {
    key: string;
    value: Attempt;
    indexes: { "by-created": number; "by-session": string; "by-progress": string };
  };
  sessions: {
    key: string;
    value: StudySession;
    indexes: { "by-started": number };
  };
  settings: {
    key: string;
    value: Settings;
  };
  meta: {
    key: string;
    value: MetaRecord;
  };
}

export const STORE_NAMES = [
  "lessons",
  "sentences",
  "vocab",
  "progress",
  "attempts",
  "sessions",
  "settings",
  "meta",
] as const;

/**
 * Derived from the list rather than `keyof EngThaiDB`, because idb's DBSchema carries a
 * string index signature that would widen the union back to `string`.
 */
export type StoreName = (typeof STORE_NAMES)[number];
