import { test, expect } from "@playwright/test";

test("seeds the starter deck into IndexedDB on first visit", async ({ page }) => {
  await page.goto("/lessons/");
  await expect(page.getByText("Daily Conversation")).toBeVisible();
  await expect(page.getByText("บทสนทนาประจำวัน")).toBeVisible();
  await expect(page.getByText("3 sentences")).toBeVisible();
});

test("does not duplicate seeded rows across reloads", async ({ page }) => {
  await page.goto("/lessons/");
  await expect(page.getByText("Daily Conversation")).toBeVisible();
  await page.reload();
  await page.reload();
  await expect(page.getByText("Daily Conversation")).toHaveCount(1);

  await page.goto("/data/");
  await expect(page.getByText("Sentences").locator("xpath=following-sibling::p[1]")).toHaveText("6");
});

test("creates a progress row per item per direction", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Today’s goal")).toBeVisible();

  const progressRows = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open("engthai-trainer");
      request.onsuccess = () => resolve(request.result);
    });
    return new Promise<number>((resolve) => {
      const request = db.transaction("progress", "readonly").objectStore("progress").count();
      request.onsuccess = () => resolve(request.result);
    });
  });

  // Six sentences plus twelve vocabulary entries, each tracked in both directions.
  expect(progressRows).toBe(36);
});

test("shows seeded vocabulary with its Thai reading", async ({ page }) => {
  await page.goto("/vocabulary/");
  // Exact: the curated example sentences now contain these words too.
  await expect(page.getByText("hungry", { exact: true })).toBeVisible();
  await expect(page.getByText("หิว", { exact: true })).toBeVisible();
});

test("persists a settings change across a reload", async ({ page }) => {
  await page.goto("/settings/");
  const goal = page.getByLabel("Daily goal");
  await expect(goal).toHaveValue("20");
  await goal.fill("35");
  await expect(goal).toHaveValue("35");

  await page.reload();
  await expect(page.getByLabel("Daily goal")).toHaveValue("35");
});

test("theme choice survives a reload without a flash of the wrong theme", async ({ page }) => {
  await page.goto("/settings/");
  // The shell renders its own toggle, so scope to the one inside the settings list.
  const settingsToggle = page.locator("#main").getByRole("radio", { name: "Dark" });
  await settingsToggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.reload();
  // Set by the pre-paint script, so it is already correct before React hydrates.
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(settingsToggle).toHaveAttribute("aria-checked", "true");
});
