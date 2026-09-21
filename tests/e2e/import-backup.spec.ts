import { test, expect, type Page } from "@playwright/test";

const PASTE = [
  "Good morning | อรุณสวัสดิ์",
  "See you tomorrow | แล้วเจอกันพรุ่งนี้",
  "Where are you going? | คุณจะไปไหน",
  "good morning | สวัสดีตอนเช้า",
  "broken line with no separator",
].join("\n");

async function preview(page: Page, text: string) {
  await page.getByLabel("Lesson data to import").fill(text);
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.getByText(/rows read/)).toBeVisible();
}

async function countStore(page: Page, store: string): Promise<number> {
  return page.evaluate(async (name) => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open("engthai-trainer");
      request.onsuccess = () => resolve(request.result);
    });
    const count = await new Promise<number>((resolve) => {
      const request = db.transaction(name, "readonly").objectStore(name).count();
      request.onsuccess = () => resolve(request.result);
    });
    // Closing matters: a lingering connection blocks the delete this file also tests.
    db.close();
    return count;
  }, store);
}

test.describe("Lesson import", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/data/");
    await expect(page.getByRole("tab", { name: "Import lessons" })).toBeVisible();
  });

  test("previews new rows, both kinds of duplicate, and rejections", async ({ page }) => {
    await preview(page, PASTE);

    await expect(page.getByText("2 new")).toBeVisible();
    await expect(page.getByText("2 duplicate")).toBeVisible();
    await expect(page.getByText("1 rejected")).toBeVisible();

    await expect(page.getByText("already in your library")).toBeVisible();
    await expect(page.getByText("repeat of line 1")).toBeVisible();
    await expect(page.getByText(/thai is required/)).toBeVisible();
  });

  test("writes nothing until the import button is pressed", async ({ page }) => {
    const before = await countStore(page, "sentences");
    await preview(page, PASTE);
    expect(await countStore(page, "sentences")).toBe(before);
  });

  test("imports only the new rows when skipping duplicates", async ({ page }) => {
    const before = await countStore(page, "sentences");
    await preview(page, PASTE);

    await page.getByRole("button", { name: "Import 2 sentences" }).click();
    await expect(page.getByText("Import complete")).toBeVisible();

    expect(await countStore(page, "sentences")).toBe(before + 2);
  });

  test("creates progress rows for each imported sentence", async ({ page }) => {
    const before = await countStore(page, "progress");
    await preview(page, PASTE);
    await page.getByRole("button", { name: "Import 2 sentences" }).click();
    await expect(page.getByText("Import complete")).toBeVisible();

    // Two sentences, one card per direction.
    expect(await countStore(page, "progress")).toBe(before + 4);
  });

  test("offers to update duplicates instead, and says history is kept", async ({ page }) => {
    await preview(page, PASTE);
    await page.getByRole("button", { name: "Update existing" }).click();

    await expect(page.getByText(/schedule and answer history are kept/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Import 3 sentences" })).toBeVisible();
  });

  test("reads CSV with quoted commas", async ({ page }) => {
    await page.getByRole("button", { name: "CSV", exact: true }).click();
    await preview(page, 'english,thai\n"Let\'s go, then",ไปกันเถอะ');

    await expect(page.getByText("1 new")).toBeVisible();
    // Scoped to the preview table: the textarea still holds the same text.
    await expect(page.getByRole("cell", { name: "Let's go, then" })).toBeVisible();
  });

  test("reports a CSV missing its required columns", async ({ page }) => {
    await page.getByRole("button", { name: "CSV", exact: true }).click();
    await preview(page, "foo,bar\n1,2").catch(() => {});

    await expect(page.getByText(/needs an "english" and a "thai" column/)).toBeVisible();
  });

  test("reports malformed JSON without writing anything", async ({ page }) => {
    const before = await countStore(page, "sentences");
    await page.getByRole("button", { name: "JSON", exact: true }).click();
    await page.getByLabel("Lesson data to import").fill("{nope");
    await page.getByRole("button", { name: "Preview", exact: true }).click();

    await expect(page.getByText(/not valid JSON/)).toBeVisible();
    expect(await countStore(page, "sentences")).toBe(before);
  });
});

test.describe("Backup and restore", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/data/");
    await page.getByRole("tab", { name: "Backup & restore" }).click();
  });

  /** Captures the exact file the app hands to the browser. */
  async function exportAndCapture(page: Page): Promise<string> {
    await page.evaluate(() => {
      const real = URL.createObjectURL.bind(URL);
      (window as unknown as { __captured?: Blob }).__captured = undefined;
      URL.createObjectURL = (blob: Blob) => {
        (window as unknown as { __captured?: Blob }).__captured = blob;
        return real(blob);
      };
    });

    await page.getByRole("button", { name: "Export backup" }).click();
    await expect(page.getByText(/Backup saved with/)).toBeVisible();

    return page.evaluate(async () => {
      const blob = (window as unknown as { __captured?: Blob }).__captured;
      if (!blob) throw new Error("no backup was produced");
      return blob.text();
    });
  }

  async function feedBackup(page: Page, content: string) {
    await page
      .locator('input[type="file"][accept*="json"]')
      .last()
      .setInputFiles({ name: "backup.json", mimeType: "application/json", buffer: Buffer.from(content) });
  }

  test("exports a self-describing, versioned snapshot", async ({ page }) => {
    const text = await exportAndCapture(page);
    const backup = JSON.parse(text);

    expect(backup.format).toBe("engthai-trainer-backup");
    expect(backup.formatVersion).toBe(1);
    expect(backup.data.sentences.length).toBeGreaterThan(0);
    expect(backup.data.progress.length).toBeGreaterThan(0);
  });

  test("round-trips through delete and restore", async ({ page }) => {
    const text = await exportAndCapture(page);
    const sentencesBefore = await countStore(page, "sentences");
    const progressBefore = await countStore(page, "progress");

    await page.getByRole("button", { name: "Delete all data…" }).click();
    await page.getByLabel(/Type DELETE to confirm/).fill("DELETE");
    await page.getByRole("button", { name: "Delete everything" }).click();
    await expect(page.getByText("All data deleted.")).toBeVisible();
    expect(await countStore(page, "sentences")).toBe(0);

    await feedBackup(page, text);
    await expect(page.getByText("Ready to restore")).toBeVisible();
    await page.getByRole("button", { name: "Replace my data" }).click();

    await expect(page.getByText("Backup restored. Everything was replaced.")).toBeVisible();
    expect(await countStore(page, "sentences")).toBe(sentencesBefore);
    expect(await countStore(page, "progress")).toBe(progressBefore);
  });

  test("refuses a lesson file offered as a backup", async ({ page }) => {
    await feedBackup(page, '[{"english":"hi","thai":"สวัสดี"}]');
    await expect(page.getByText("This is not a valid backup")).toBeVisible();
    await expect(page.getByRole("button", { name: "Replace my data" })).toHaveCount(0);
  });

  test("refuses a backup with one corrupted row, naming it", async ({ page }) => {
    const backup = JSON.parse(await exportAndCapture(page));
    backup.data.sentences[0].level = "Z9";

    await feedBackup(page, JSON.stringify(backup));
    await expect(page.getByText("This is not a valid backup")).toBeVisible();
    await expect(page.getByText(/data\.sentences\.0\.level/)).toBeVisible();
  });

  test("refuses a format version it does not understand", async ({ page }) => {
    const backup = JSON.parse(await exportAndCapture(page));
    backup.formatVersion = 99;

    await feedBackup(page, JSON.stringify(backup));
    await expect(page.getByText(/Update the app first/)).toBeVisible();
  });
});

test.describe("Delete all data", () => {
  test("stays disabled until the exact word is typed", async ({ page }) => {
    await page.goto("/data/");
    await page.getByRole("tab", { name: "Backup & restore" }).click();
    await page.getByRole("button", { name: "Delete all data…" }).click();

    const confirm = page.getByRole("button", { name: "Delete everything" });
    await expect(confirm).toBeDisabled();

    await page.getByLabel(/Type DELETE to confirm/).fill("delete");
    await expect(confirm).toBeDisabled();

    await page.getByLabel(/Type DELETE to confirm/).fill("DELETE");
    await expect(confirm).toBeEnabled();
  });

  test("offers a backup before deleting", async ({ page }) => {
    await page.goto("/data/");
    await page.getByRole("tab", { name: "Backup & restore" }).click();
    await page.getByRole("button", { name: "Delete all data…" }).click();

    await expect(page.getByRole("button", { name: "Export a backup first" })).toBeVisible();
  });
});

test("settings expose audio preferences and an honest AI status", async ({ page }) => {
  await page.goto("/settings/");

  await expect(page.getByRole("switch", { name: "Feedback sounds" })).toBeVisible();
  await expect(page.getByRole("switch", { name: "Spoken audio" })).toBeVisible();
  await expect(page.getByLabel("Speech rate")).toBeVisible();
  await expect(page.getByText("Not configured", { exact: true })).toBeVisible();
});
