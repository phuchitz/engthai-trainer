import { test, expect, type Page } from "@playwright/test";

/**
 * The whole trip in one test.
 *
 * Every step here is covered on its own elsewhere; this exists because passing
 * separately is not the same as composing. It walks the path a learner actually takes:
 * open the app, pick a lesson, answer, read the feedback, earn XP, reload, find the
 * progress still there, review it, and carry a backup out of the browser.
 */

const FIRST_DAILY = "Where are you going?";
const FIRST_DAILY_ANSWER = "where are you going";

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
    db.close();
    return count;
  }, store);
}

test("a learner's first session, end to end", async ({ page }) => {
  // 1. Open the app on a fresh browser profile.
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("0 / 20 sentences")).toBeVisible();

  // 2. Choose a lesson from the Lessons screen, not by typing a URL.
  await page.getByRole("link", { name: /Start learning/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Lessons" })).toBeVisible();

  const daily = page.getByRole("listitem").filter({ hasText: "Daily Conversation" });
  await expect(daily.getByText("10 sentences")).toBeVisible();
  await expect(daily.getByText("0% complete")).toBeVisible();
  await daily.getByRole("link", { name: "Start dictation" }).click();

  // 3. Complete an exercise.
  await expect(page.getByText("Card 1 of 10")).toBeVisible();
  await page.getByLabel("Type what you hear, in English").fill(FIRST_DAILY_ANSWER);
  await page.getByRole("button", { name: /^Check/ }).click();

  // 4. Check the feedback: a grade, a score, the answer and the Thai note.
  await expect(page.getByRole("button", { name: /^Next/ })).toBeVisible();
  await expect(page.getByText("Perfect", { exact: true })).toBeVisible();
  await expect(page.getByText("100%")).toBeVisible();
  await expect(page.getByText(FIRST_DAILY)).toBeVisible();
  // The same verdict reaches a screen reader as words rather than a colour.
  await expect(page.locator('[role="status"][aria-live="polite"]')).toContainText("Perfect. 100 percent.");

  // 5. Receive XP, and see the streak and goal move with it.
  await expect(page.getByText("+10 XP").first()).toBeVisible();
  await expect(page.getByText("🔥 1")).toBeVisible();
  await expect(page.getByText("Goal 1/20 (5%)")).toBeVisible();

  // 6. Reload, and find the progress still there.
  await page.reload();
  // The answered card is scheduled for tomorrow, so nine unseen cards remain.
  await expect(page.getByText("Card 1 of 9")).toBeVisible();
  await expect(page.getByText("Goal 1/20 (5%)")).toBeVisible();

  await page.goto("/");
  await expect(page.getByText("1 / 20 sentences")).toBeVisible();
  await expect(page.getByText("First sentence")).toBeVisible();

  await page.goto("/lessons/");
  await expect(
    page.getByRole("listitem").filter({ hasText: "Daily Conversation" }).getByText("10% complete"),
  ).toBeVisible();

  // 7. Open Review. The card was answered correctly, so it is scheduled rather than
  //    a mistake — the queues are separate and both must say the truth.
  await page.goto("/review/");
  await expect(page.getByRole("heading", { level: 1, name: "Review" })).toBeVisible();
  // Exact: getByText is case-insensitive on substrings, and the page description
  // also says "due today".
  await expect(page.getByText("Due today", { exact: true })).toBeVisible();
  await expect(page.getByText("Mistakes", { exact: true })).toBeVisible();
  // The answer was right, so it belongs to the schedule and not to the drill.
  await expect(page.getByText("No mistakes to drill — nothing has been answered wrong yet.")).toBeVisible();

  // 8. Export a backup and confirm the session is inside it.
  await page.goto("/data/");
  await page.getByRole("tab", { name: "Backup & restore" }).click();

  await page.evaluate(() => {
    const real = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob: Blob) => {
      (window as unknown as { __captured?: Blob }).__captured = blob;
      return real(blob);
    };
  });
  await page.getByRole("button", { name: "Export backup" }).click();
  await expect(page.getByText(/Backup saved with/)).toBeVisible();

  const text = await page.evaluate(async () => {
    const blob = (window as unknown as { __captured?: Blob }).__captured;
    if (!blob) throw new Error("no backup was produced");
    return blob.text();
  });

  const backup = JSON.parse(text) as {
    format: string;
    formatVersion: number;
    data: { attempts: { xpAwarded: number }[]; sentences: unknown[]; progress: unknown[] };
  };

  expect(backup.format).toBe("engthai-trainer-backup");
  expect(backup.formatVersion).toBe(1);
  expect(backup.data.sentences).toHaveLength(await countStore(page, "sentences"));
  // The answer itself travelled, not just the library.
  expect(backup.data.attempts).toHaveLength(1);
  expect(backup.data.attempts[0].xpAwarded).toBe(10);
});

test("a wrong answer takes the same journey into the mistake queue", async ({ page }) => {
  await page.goto("/learn/?category=daily&mode=translate");
  await page.getByLabel("Translate this sentence into English").fill("completely wrong");
  await page.getByRole("button", { name: /^Check/ }).click();
  await expect(page.getByRole("button", { name: /^Next/ })).toBeVisible();

  await expect(page.getByText("Try Again", { exact: true })).toBeVisible();
  await expect(page.getByText("No XP — that answer was not a pass.")).toBeVisible();

  await page.reload();
  await page.goto("/review/");
  await expect(page.getByRole("link", { name: "Start mistakes" })).toBeVisible();

  await page.goto("/review/?queue=mistakes");
  await expect(page.getByText("Card 1 of 1")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Check/ })).toBeVisible();
});
