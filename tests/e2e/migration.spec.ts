import { test, expect } from "@playwright/test";

/**
 * Runs against a real browser on purpose.
 *
 * The first version of the v2 migration used a cursor loop with `await cursor.update()`
 * inside it. fake-indexeddb passed it; Chrome silently backfilled nothing, because
 * awaiting between cursor steps lets the upgrade transaction auto-commit. Only a real
 * IndexedDB implementation catches that, so this regression lives here rather than in
 * the unit suite.
 */
test("backfills categories when upgrading a v1 database", async ({ page }) => {
  await page.goto("/lessons/");
  await expect(page.getByText("Daily Conversation")).toBeVisible();

  // Replace the database with a genuine v1 one holding rows that predate categories.
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase("engthai-trainer");
      request.onsuccess = request.onerror = request.onblocked = () => resolve();
    });

    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("engthai-trainer", 1);
      request.onupgradeneeded = () => {
        const d = request.result;
        const lessons = d.createObjectStore("lessons", { keyPath: "id" });
        lessons.createIndex("by-level", "level");
        lessons.createIndex("by-source", "source");
        const sentences = d.createObjectStore("sentences", { keyPath: "id" });
        sentences.createIndex("by-level", "level");
        sentences.createIndex("by-source", "source");
        sentences.createIndex("by-tag", "tags", { multiEntry: true });
        sentences.createIndex("by-lesson", "lessonIds", { multiEntry: true });
        const vocab = d.createObjectStore("vocab", { keyPath: "id" });
        vocab.createIndex("by-en", "en");
        vocab.createIndex("by-th", "th");
        vocab.createIndex("by-source", "source");
        const progress = d.createObjectStore("progress", { keyPath: "id" });
        progress.createIndex("by-item", ["itemType", "itemId"]);
        progress.createIndex("by-due", ["state", "nextReviewAt"]);
        progress.createIndex("by-next-review", "nextReviewAt");
        const attempts = d.createObjectStore("attempts", { keyPath: "id" });
        attempts.createIndex("by-created", "createdAt");
        attempts.createIndex("by-session", "sessionId");
        attempts.createIndex("by-progress", "progressId");
        d.createObjectStore("sessions", { keyPath: "id" }).createIndex("by-started", "startedAt");
        d.createObjectStore("settings", { keyPath: "id" });
        d.createObjectStore("meta", { keyPath: "key" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const now = Date.now();
    const tx = db.transaction(["sentences", "meta"], "readwrite");
    for (let i = 1; i <= 4; i++) {
      tx.objectStore("sentences").put({
        id: `legacy-000${i}`,
        en: `Legacy sentence ${i}.`,
        th: `ประโยคเก่า ${i}`,
        enAlternates: [],
        thAlternates: [],
        tags: [],
        level: "A1",
        lessonIds: [],
        vocabIds: [],
        source: "builtin",
        createdAt: now,
        updatedAt: now,
      });
    }
    // Marks the seed as already applied, so only the legacy rows are present.
    tx.objectStore("meta").put({ key: "seed", value: { version: 2, appliedAt: now } });
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
    });
    db.close();
  });

  await page.reload();
  await expect(page.getByText("Daily Conversation")).toBeVisible();

  const migrated = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("engthai-trainer");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const read = (mode: "all" | "index") =>
      new Promise<unknown[]>((resolve) => {
        const store = db.transaction("sentences", "readonly").objectStore("sentences");
        const request = mode === "all" ? store.getAll() : store.index("by-category").getAll("daily");
        request.onsuccess = () => resolve(request.result);
      });
    return { version: db.version, all: await read("all"), viaIndex: await read("index") };
  });

  expect(migrated.version).toBe(2);
  expect(migrated.all).toHaveLength(4);
  expect((migrated.all as { category?: string }[]).every((s) => s.category === "daily")).toBe(true);
  // The index is the part that silently broke: a row with no category is absent from it.
  expect(migrated.viaIndex).toHaveLength(4);

  await expect(page.getByText("4 sentences")).toBeVisible();
});
