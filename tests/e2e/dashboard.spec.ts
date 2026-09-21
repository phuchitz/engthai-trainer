import { test, expect, type Page } from "@playwright/test";

async function answerTranslate(page: Page, text: string) {
  await page.getByLabel("Translate this sentence into English").fill(text);
  await page.getByRole("button", { name: /^Check/ }).click();
  await expect(page.getByRole("button", { name: /^Next/ })).toBeVisible();
}

/** Reads the value under a stat tile's label. */
function stat(page: Page, label: string) {
  return page.getByText(label, { exact: true }).locator("xpath=following-sibling::p[1]");
}

test.describe("Dashboard with no history", () => {
  test("shows honest zeros and an em dash rather than a misleading 0%", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("0 / 20 sentences")).toBeVisible();
    await expect(stat(page, "Accuracy today")).toHaveText("—");
    await expect(stat(page, "Active time")).toHaveText("0s");
    await expect(stat(page, "XP today")).toHaveText("0");
  });

  test("offers both entry points", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /Start learning/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Review mistakes/ })).toBeVisible();
  });

  test("shows every achievement locked", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/Achievements \(0\/\d+\)/)).toBeVisible();
    await expect(page.getByText("First sentence")).toBeVisible();
  });
});

test.describe("Dashboard after studying", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/learn/?category=daily&mode=translate");
    await answerTranslate(page, "where are you going");
    await page.getByRole("button", { name: /^Next/ }).click();
    await answerTranslate(page, "totally wrong answer here");
  });

  test("reflects the session in every figure", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("1 / 20 sentences")).toBeVisible();
    await expect(stat(page, "XP today")).toHaveText("10");
    // One pass out of two graded answers.
    await expect(stat(page, "Accuracy today")).toHaveText("50%");
    await expect(stat(page, "Streak")).toHaveText("🔥 1");
  });

  test("lists the category under recent lessons", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Recent lessons")).toBeVisible();
    // Scoped: the accuracy tiles also mention a count of answers.
    const entry = page.getByRole("listitem").filter({ hasText: "Daily Conversation" });
    await expect(entry).toContainText("2 answers");
    await expect(entry.getByRole("link", { name: "Continue" })).toBeVisible();
  });

  test("unlocks the first achievement", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/Achievements \(1\/\d+\)/)).toBeVisible();
  });

  test("survives a reload without drifting", async ({ page }) => {
    await page.goto("/");
    const before = await stat(page, "XP today").textContent();
    const accuracyBefore = await stat(page, "Accuracy today").textContent();

    await page.reload();

    await expect(stat(page, "XP today")).toHaveText(before ?? "");
    await expect(stat(page, "Accuracy today")).toHaveText(accuracyBefore ?? "");
    await expect(page.getByText("1 / 20 sentences")).toBeVisible();
  });
});

test("the daily goal counts distinct sentences, not cards", async ({ page }) => {
  // The same sentence in both directions is two cards but one sentence.
  await page.goto("/learn/?category=daily&mode=translate");
  await answerTranslate(page, "where are you going");

  await page.goto("/learn/?category=daily&mode=wordOrder");
  const pool = page.getByRole("group", { name: "Available words" });
  for (const word of ["คุณ", "จะ", "ไป", "ไหน"]) {
    await pool.getByRole("button", { name: word, exact: true }).click();
  }
  await page.getByRole("button", { name: /^Check/ }).click();
  await expect(page.getByRole("button", { name: /^Next/ })).toBeVisible();

  await page.goto("/");
  await expect(page.getByText("1 / 20 sentences")).toBeVisible();
  // Both cards still paid XP, because XP is per card.
  await expect(stat(page, "XP today")).toHaveText("20");
});

test.describe("Session summary", () => {
  test("reports the session and what it unlocked", async ({ page }) => {
    await page.goto("/learn/?category=meetings&mode=translate");
    await answerTranslate(page, "I have no blockers today");
    await page.getByRole("button", { name: /^Next/ }).click();

    await expect(page.getByText("Session complete")).toBeVisible();
    await expect(page.getByText("1 answered")).toBeVisible();
    await expect(stat(page, "Correct")).toHaveText("1/1");
    await expect(stat(page, "Accuracy")).toHaveText("100%");
    await expect(stat(page, "XP earned")).toHaveText("10");
    await expect(page.getByText("Achievement unlocked")).toBeVisible();
    await expect(page.getByText("First sentence")).toBeVisible();
  });

  test("offers a way back and a link to the dashboard", async ({ page }) => {
    await page.goto("/learn/?category=meetings&mode=translate");
    await answerTranslate(page, "I have no blockers today");
    await page.getByRole("button", { name: /^Next/ }).click();

    // Scoped: the sidebar has a Dashboard link too.
    await page.locator("#main").getByRole("link", { name: "Dashboard" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
  });
});

test.describe("Feedback sounds", () => {
  test("are off by default and can be turned on", async ({ page }) => {
    await page.goto("/settings/");
    const toggle = page.getByRole("switch", { name: "Feedback sounds" });

    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");

    await page.reload();
    await expect(page.getByRole("switch", { name: "Feedback sounds" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });
});

test("active time excludes background stretches", async ({ page }) => {
  await page.goto("/learn/?category=software&mode=translate");
  await expect(page.getByLabel("Translate this sentence into English")).toBeVisible();

  // Pretend the tab was backgrounded for four seconds.
  await page.evaluate(async () => {
    let hidden = false;
    Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
    const set = (value: boolean) => {
      hidden = value;
      document.dispatchEvent(new Event("visibilitychange"));
    };
    set(true);
    await new Promise((resolve) => setTimeout(resolve, 4000));
    set(false);
  });

  await answerTranslate(page, "let's deploy this after the review");

  const durationMs = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open("engthai-trainer");
      request.onsuccess = () => resolve(request.result);
    });
    const rows = await new Promise<{ createdAt: number; durationMs: number }[]>((resolve) => {
      const request = db.transaction("attempts", "readonly").objectStore("attempts").getAll();
      request.onsuccess = () => resolve(request.result);
    });
    return rows.sort((a, b) => a.createdAt - b.createdAt).at(-1)!.durationMs;
  });

  // The card was open for well over four seconds; the background stretch is not in there.
  expect(durationMs).toBeLessThan(4000);
});
