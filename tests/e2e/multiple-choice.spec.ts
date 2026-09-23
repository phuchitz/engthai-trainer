import { test, expect, type Page } from "@playwright/test";

const options = (page: Page) => page.getByRole("radiogroup", { name: "Answer options" }).getByRole("radio");

/** Picks the option matching `text`, which the test knows from the seed deck. */
async function choose(page: Page, text: string) {
  await options(page).filter({ hasText: text }).click();
}

const check = (page: Page) => page.getByRole("button", { name: /^Check/ });

test.describe("Asking the question", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/learn/?category=daily&mode=multipleChoice");
    await expect(page.getByText("Card 1 of 10")).toBeVisible();
  });

  test("shows a Thai prompt and four English options", async ({ page }) => {
    await expect(page.locator("#main p[lang='th']").filter({ hasText: "คุณจะไปไหน" })).toBeVisible();
    await expect(options(page)).toHaveCount(4);
    await expect(page.getByText("Choose the English sentence that matches")).toBeVisible();
  });

  test("offers the right answer among real sentences from the library", async ({ page }) => {
    const texts = await options(page).allTextContents();
    expect(texts.some((t) => t.includes("Where are you going?"))).toBe(true);
    // Every wrong answer is another seeded sentence, never invented text.
    expect(new Set(texts).size).toBe(texts.length);
  });

  test("draws its distractors from the same category", async ({ page }) => {
    // A wrong answer from another topic can be ruled out without reading the Thai.
    const texts = (await options(page).allTextContents()).map((t) => t.replace(/^\d\s*/, "").trim());
    const daily = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve) => {
        const request = indexedDB.open("engthai-trainer");
        request.onsuccess = () => resolve(request.result);
      });
      const rows = await new Promise<{ en: string; category: string }[]>((resolve) => {
        const request = db.transaction("sentences", "readonly").objectStore("sentences").getAll();
        request.onsuccess = () => resolve(request.result);
      });
      db.close();
      return rows.filter((r) => r.category === "daily").map((r) => r.en);
    });

    for (const text of texts) expect(daily, text).toContain(text);
  });

  test("cannot be submitted until something is picked", async ({ page }) => {
    await expect(check(page)).toBeDisabled();
    await choose(page, "Where are you going?");
    await expect(check(page)).toBeEnabled();
  });

  test("shows the same question after a reload", async ({ page }) => {
    const before = await options(page).allTextContents();
    await page.reload();
    await expect(options(page)).toHaveCount(4);
    expect(await options(page).allTextContents()).toEqual(before);
  });

  test("says up front that it does not move the schedule", async ({ page }) => {
    await expect(page.getByText(/this is practice only — it never moves the schedule/i)).toBeVisible();
  });
});

test.describe("Answering", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/learn/?category=daily&mode=multipleChoice");
    await expect(page.getByText("Card 1 of 10")).toBeVisible();
  });

  test("a correct pick scores full marks and pays XP", async ({ page }) => {
    await choose(page, "Where are you going?");
    await check(page).click();

    await expect(page.getByText("Perfect", { exact: true })).toBeVisible();
    await expect(page.getByText("100%")).toBeVisible();
    await expect(page.getByText("+10 XP").first()).toBeVisible();
  });

  test("a wrong pick scores zero rather than partial credit", async ({ page }) => {
    const texts = await options(page).allTextContents();
    const wrong = texts.find((t) => !t.includes("Where are you going?"))!;
    await choose(page, wrong.replace(/^\d/, "").trim());
    await check(page).click();

    await expect(page.getByText("Try Again", { exact: true })).toBeVisible();
    await expect(page.getByText("0%", { exact: true })).toBeVisible();
    await expect(page.getByText("No XP — that answer was not a pass.")).toBeVisible();
    await expect(page.getByText(/being close to one is not being right/)).toBeVisible();
  });

  test("states the real reason nothing was scheduled", async ({ page }) => {
    await choose(page, "Where are you going?");
    await check(page).click();

    // Not "already updated today" — nothing had been answered yet.
    await expect(
      page.getByText("Practice only — the schedule moves on an answer you produce, not one you pick."),
    ).toBeVisible();
  });

  test("announces the verdict to a screen reader", async ({ page }) => {
    await choose(page, "Where are you going?");
    await check(page).click();
    await expect(page.getByRole("button", { name: /^Next/ })).toBeVisible();

    await expect(page.locator('[role="status"][aria-live="polite"]')).toContainText("Perfect. 100 percent.");
  });
});

test.describe("Keyboard", () => {
  test("number keys pick an option", async ({ page }) => {
    await page.goto("/learn/?category=daily&mode=multipleChoice");
    await expect(page.getByText("Card 1 of 10")).toBeVisible();

    await page.keyboard.press("2");
    await expect(options(page).nth(1)).toHaveAttribute("aria-checked", "true");

    await page.keyboard.press("4");
    await expect(options(page).nth(3)).toHaveAttribute("aria-checked", "true");
    await expect(options(page).nth(1)).toHaveAttribute("aria-checked", "false");
  });

  test("a digit outside the options changes nothing", async ({ page }) => {
    await page.goto("/learn/?category=daily&mode=multipleChoice");
    await expect(page.getByText("Card 1 of 10")).toBeVisible();

    await page.keyboard.press("9");
    await expect(check(page)).toBeDisabled();
  });

  test("digits are left alone in a mode that types", async ({ page }) => {
    // The shortcut is guarded by the mode, or every typed digit would be swallowed.
    await page.goto("/learn/?category=daily&mode=translate");
    const field = page.getByLabel("Translate this sentence into English");
    await field.click();
    await page.keyboard.type("meet at 3");

    await expect(field).toHaveValue("meet at 3");
  });
});

test("the schedule only moves on an answer the learner produces", async ({ page }) => {
  const scheduling = async () =>
    page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve) => {
        const request = indexedDB.open("engthai-trainer");
        request.onsuccess = () => resolve(request.result);
      });
      const row = await new Promise<{ practiceCount: number; intervalDays: number } | undefined>(
        (resolve) => {
          const request = db
            .transaction("progress", "readonly")
            .objectStore("progress")
            .get("sentence:seed-sentence-0001:th2en");
          request.onsuccess = () => resolve(request.result);
        },
      );
      db.close();
      return row ?? null;
    });

  await page.goto("/learn/?category=daily&mode=multipleChoice");
  await expect(page.getByText("Card 1 of 10")).toBeVisible();
  await choose(page, "Where are you going?");
  await check(page).click();
  await expect(page.getByRole("button", { name: /^Next/ })).toBeVisible();

  expect(await scheduling()).toMatchObject({ practiceCount: 0, intervalDays: 0 });

  // The same card, typed, still schedules — the pick did not consume the day's move.
  await page.goto("/learn/?category=daily&mode=translate");
  await page.getByLabel("Translate this sentence into English").fill("where are you going");
  await check(page).click();
  await expect(page.getByRole("button", { name: /^Next/ })).toBeVisible();

  expect(await scheduling()).toMatchObject({ practiceCount: 1, intervalDays: 1 });
});
