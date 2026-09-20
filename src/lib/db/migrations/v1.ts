import type { Migration } from "./types";

export const v1: Migration = {
  version: 1,
  description: "Create the initial stores and indexes.",
  migrate: ({ db }) => {
    const lessons = db.createObjectStore("lessons", { keyPath: "id" });
    lessons.createIndex("by-level", "level");
    lessons.createIndex("by-source", "source");

    const sentences = db.createObjectStore("sentences", { keyPath: "id" });
    sentences.createIndex("by-level", "level");
    sentences.createIndex("by-source", "source");
    sentences.createIndex("by-tag", "tags", { multiEntry: true });
    sentences.createIndex("by-lesson", "lessonIds", { multiEntry: true });

    const vocab = db.createObjectStore("vocab", { keyPath: "id" });
    vocab.createIndex("by-en", "en");
    vocab.createIndex("by-th", "th");
    vocab.createIndex("by-source", "source");

    const progress = db.createObjectStore("progress", { keyPath: "id" });
    progress.createIndex("by-item", ["itemType", "itemId"]);
    progress.createIndex("by-due", ["state", "nextReviewAt"]);
    progress.createIndex("by-next-review", "nextReviewAt");

    const attempts = db.createObjectStore("attempts", { keyPath: "id" });
    attempts.createIndex("by-created", "createdAt");
    attempts.createIndex("by-session", "sessionId");
    attempts.createIndex("by-progress", "progressId");

    const sessions = db.createObjectStore("sessions", { keyPath: "id" });
    sessions.createIndex("by-started", "startedAt");

    db.createObjectStore("settings", { keyPath: "id" });
    db.createObjectStore("meta", { keyPath: "key" });
  },
};
