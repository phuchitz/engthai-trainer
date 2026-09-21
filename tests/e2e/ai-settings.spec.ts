import { test, expect, type Page } from "@playwright/test";

async function readSettings(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open("engthai-trainer");
      request.onsuccess = () => resolve(request.result);
    });
    const row = await new Promise<{ ai: Record<string, unknown> } | undefined>((resolve) => {
      const request = db.transaction("settings", "readonly").objectStore("settings").get("singleton");
      request.onsuccess = () => resolve(request.result);
    });
    db.close();
    return row ?? null;
  });
}

test.describe("AI is off by default", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/settings/");
    await expect(page.getByRole("heading", { name: "AI assistance" })).toBeVisible();
  });

  test("reports the real provider state, not a placeholder", async ({ page }) => {
    await expect(page.getByText("Not configured — no provider is available in this build")).toBeVisible();
    await expect(page.getByText("Not configured", { exact: true })).toBeVisible();
  });

  test("says the app works without it", async ({ page }) => {
    await expect(page.getByText(/Every part of EngThai Trainer works without AI/)).toBeVisible();
  });

  test("lists every capability", async ({ page }) => {
    for (const label of [
      "Explain a mistake in Thai",
      "Generate a lesson from a topic",
      "Generate sentences at a CEFR level",
      "Extract vocabulary from a sentence",
      "Translate into Thai",
      "Build a fill-in-the-blank exercise",
      "Suggest follow-up questions",
    ]) {
      await expect(page.getByText(label)).toBeVisible();
    }
  });

  test("starts with consent withheld", async ({ page }) => {
    const toggle = page.getByRole("switch", { name: "Send learning content to an AI provider" });
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await expect(page.getByText(/Every AI call is refused until you do/)).toBeVisible();
  });
});

test.describe("Consent disclosure", () => {
  test("shows the literal values that would be sent", async ({ page }) => {
    await page.goto("/settings/");
    await page.getByRole("button", { name: /exactly what would be sent/ }).click();

    await expect(page.getByText("Your answer").first()).toBeVisible();
    // Literal payload values, not a summary.
    await expect(page.getByText("I very hungry")).toBeVisible();
    await expect(page.getByText("ฉันหิวมาก").first()).toBeVisible();
  });

  test("states what is never sent", async ({ page }) => {
    await page.goto("/settings/");
    await page.getByRole("button", { name: /exactly what would be sent/ }).click();

    await expect(page.getByText("Never sent")).toBeVisible();
    await expect(page.getByText(/Your answer history/)).toBeVisible();
    await expect(page.getByText(/never used by an AI feature/)).toBeVisible();
  });
});

test("consent is recorded and survives a reload", async ({ page }) => {
  await page.goto("/settings/");
  const toggle = page.getByRole("switch", { name: "Send learning content to an AI provider" });

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");

  const stored = await readSettings(page);
  expect(stored?.ai.consentGivenAt).toEqual(expect.any(Number));

  await page.reload();
  await expect(page.getByRole("switch", { name: "Send learning content to an AI provider" })).toHaveAttribute(
    "aria-checked",
    "true",
  );

  // Agreeing changes nothing while no provider exists.
  await expect(page.getByText(/nothing is sent whatever this is set to/)).toBeVisible();
});

test("no credential is ever stored in settings", async ({ page }) => {
  await page.goto("/settings/");
  // The settings row is written on first read, which rendering this panel triggers.
  await expect(page.getByRole("heading", { name: "AI assistance" })).toBeVisible();

  const stored = await readSettings(page);

  expect(stored?.ai).not.toHaveProperty("apiKey");
  expect(JSON.stringify(stored)).not.toMatch(/apiKey|secret|sk-/i);
});

test("upgrading a database that holds a key strips it", async ({ page }) => {
  // Set up on the 404 page: it shares the origin but renders no screen, so the app
  // never opens the database and cannot re-create it at the current version between
  // the delete below and the open that follows.
  await page.goto("/no-such-page/");

  // Replace the database with a genuine v4 one carrying a credential.
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase("engthai-trainer");
      // Only success ends the wait: resolving on `blocked` would leave the delete
      // pending, and opening at an older version would then fail. The app releases its
      // own handle through its `blocking` handler.
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("engthai-trainer", 4);
      request.onupgradeneeded = () => {
        const d = request.result;
        const lessons = d.createObjectStore("lessons", { keyPath: "id" });
        lessons.createIndex("by-level", "level");
        lessons.createIndex("by-source", "source");
        const s = d.createObjectStore("sentences", { keyPath: "id" });
        s.createIndex("by-level", "level");
        s.createIndex("by-source", "source");
        s.createIndex("by-tag", "tags", { multiEntry: true });
        s.createIndex("by-lesson", "lessonIds", { multiEntry: true });
        s.createIndex("by-category", "category");
        const v = d.createObjectStore("vocab", { keyPath: "id" });
        v.createIndex("by-en", "en");
        v.createIndex("by-th", "th");
        v.createIndex("by-source", "source");
        const p = d.createObjectStore("progress", { keyPath: "id" });
        p.createIndex("by-item", ["itemType", "itemId"]);
        p.createIndex("by-due", ["state", "nextReviewAt"]);
        p.createIndex("by-next-review", "nextReviewAt");
        const a = d.createObjectStore("attempts", { keyPath: "id" });
        a.createIndex("by-created", "createdAt");
        a.createIndex("by-session", "sessionId");
        a.createIndex("by-progress", "progressId");
        d.createObjectStore("sessions", { keyPath: "id" }).createIndex("by-started", "startedAt");
        d.createObjectStore("settings", { keyPath: "id" });
        d.createObjectStore("meta", { keyPath: "key" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const now = Date.now();
    const tx = db.transaction(["settings", "meta"], "readwrite");
    tx.objectStore("settings").put({
      id: "singleton",
      dailyGoal: 20,
      newPerDay: 10,
      maxReviewsPerDay: 120,
      strictness: "normal",
      ignoreCase: true,
      ignorePunctuation: true,
      ttsEnabled: true,
      ttsVoiceEn: null,
      ttsVoiceTh: null,
      ttsRate: 1,
      sttEnabled: false,
      soundEnabled: false,
      uiLanguage: "en",
      ai: { enabled: true, provider: "openai", apiKey: "sk-LEAKED-SECRET", model: "gpt-x" },
      streak: { current: 0, longest: 0, lastStudyDate: null, freezesRemaining: 0 },
      createdAt: now,
      updatedAt: now,
    });
    tx.objectStore("meta").put({ key: "seed", value: { version: 9999, appliedAt: now } });
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
    });
    db.close();
  });

  await page.goto("/settings/");
  await expect(page.getByRole("heading", { name: "AI assistance" })).toBeVisible();

  const stored = await readSettings(page);
  expect(stored?.ai).not.toHaveProperty("apiKey");
  expect(JSON.stringify(stored)).not.toContain("sk-LEAKED-SECRET");
  // The rest of the AI settings survive.
  expect(stored?.ai.provider).toBe("openai");

  // And an unregistered provider is still reported honestly as unavailable.
  await expect(page.getByText("Not configured — no provider is available in this build")).toBeVisible();
});
