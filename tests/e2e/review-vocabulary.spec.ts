import { test, expect, type Page } from "@playwright/test";

const check = (page: Page) => page.getByRole("button", { name: /^Check/ });

async function answerTranslate(page: Page, text: string) {
  await page.getByLabel("Translate this sentence into English").fill(text);
  await check(page).click();
  await expect(page.getByRole("button", { name: /^Next/ })).toBeVisible();
}

test.describe("Review queues", () => {
  test("shows a due queue and a mistake queue separately", async ({ page }) => {
    await page.goto("/review/");
    await expect(page.getByText("Due today")).toBeVisible();
    await expect(page.getByText("Mistakes", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Cards you have got wrong, worst first — regardless of when they are next due."),
    ).toBeVisible();
  });

  test("both queues start empty on a fresh library", async ({ page }) => {
    await page.goto("/review/");
    await expect(
      page.getByText("Nothing is due right now. Study a lesson to put cards into the schedule."),
    ).toBeVisible();
    await expect(page.getByText("No mistakes to drill — nothing has been answered wrong yet.")).toBeVisible();
  });

  test("the mistake queue fills after a wrong answer, and the due queue does not double-count", async ({
    page,
  }) => {
    await page.goto("/learn/?category=daily&mode=translate");
    await answerTranslate(page, "completely wrong sentence here");

    await page.goto("/review/");
    // One card failed, and a lapse leaves it due the same day, so it is in both.
    await expect(page.getByRole("link", { name: "Start mistakes" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Start due today" })).toBeVisible();
  });

  test("a correct answer creates a due card but no mistake", async ({ page }) => {
    await page.goto("/learn/?category=daily&mode=translate");
    await answerTranslate(page, "where are you going");

    await page.goto("/review/");
    await expect(page.getByText("No mistakes to drill — nothing has been answered wrong yet.")).toBeVisible();
  });

  test("runs a review card in the mode its direction implies", async ({ page }) => {
    await page.goto("/learn/?category=daily&mode=translate");
    await answerTranslate(page, "completely wrong sentence here");

    await page.goto("/review/?queue=mistakes");
    await expect(page.getByText("Card 1 of 1")).toBeVisible();
    // A th2en card is reviewed as a translation, never as dictation.
    await expect(page.getByLabel("Translate this sentence into English")).toBeVisible();
  });

  test("reviewing reports that the schedule was already moved today", async ({ page }) => {
    await page.goto("/learn/?category=daily&mode=translate");
    await answerTranslate(page, "completely wrong sentence here");

    await page.goto("/review/?queue=mistakes");
    await answerTranslate(page, "where are you going");

    await expect(
      page.getByText("Schedule already updated for this card today, so this attempt was practice only."),
    ).toBeVisible();
  });
});

test.describe("Word panel", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/learn/?category=daily&mode=translate");
    await answerTranslate(page, "where are you going");
  });

  test("opens a curated word with its full entry", async ({ page }) => {
    await page.getByRole("button", { name: "Look up going?" }).click();

    const panel = page.getByRole("dialog", { name: /About the word/ });
    await expect(panel).toBeVisible();
    // Tapped "going?" with its punctuation; resolved through the curated form list.
    await expect(panel.getByText("go", { exact: true })).toBeVisible();
    await expect(panel.getByText("/ɡəʊ/")).toBeVisible();
    await expect(panel.getByText("verb")).toBeVisible();
    await expect(panel.getByText("ไป", { exact: true })).toBeVisible();
    await expect(panel.getByText("I go to the office on Mondays.")).toBeVisible();
  });

  test("shows the meaning authored for this particular sentence", async ({ page }) => {
    await page.getByRole("button", { name: "Look up going?" }).click();
    const panel = page.getByRole("dialog", { name: /About the word/ });
    await expect(panel.getByText("In this sentence")).toBeVisible();
    await expect(panel.getByText(/กำลังจะเดินทางไป/)).toBeVisible();
  });

  test("reports an encounter count derived from practice", async ({ page }) => {
    await page.getByRole("button", { name: "Look up going?" }).click();
    await expect(page.getByText("1 time")).toBeVisible();
  });

  test("never invents data for an uncurated word", async ({ page }) => {
    await page.getByRole("button", { name: "Look up are" }).click();

    const panel = page.getByRole("dialog", { name: /About the word/ });
    await expect(panel.getByText(/No dictionary entry for/)).toBeVisible();
    await expect(panel.getByText(/nothing here is guessed/)).toBeVisible();
    // No fabricated pronunciation, part of speech or meaning.
    await expect(panel.getByText("Part of speech")).toHaveCount(0);
    await expect(panel.getByText("Thai", { exact: true })).toHaveCount(0);
  });

  test("closes with Escape", async ({ page }) => {
    await page.getByRole("button", { name: "Look up going?" }).click();
    await expect(page.getByRole("dialog", { name: /About the word/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: /About the word/ })).toHaveCount(0);
  });
});

test.describe("Saving vocabulary", () => {
  test("a saved word reaches the Vocabulary screen and survives a reload", async ({ page }) => {
    await page.goto("/learn/?category=daily&mode=translate");
    await answerTranslate(page, "where are you going");

    await page.getByRole("button", { name: "Look up going?" }).click();
    await page.getByRole("button", { name: "Save word" }).click();
    await expect(page.getByRole("button", { name: "Saved — remove" })).toBeVisible();

    await page.goto("/vocabulary/");
    await page.getByRole("button", { name: /^Saved/ }).click();
    await expect(page.getByText("go", { exact: true })).toBeVisible();

    await page.reload();
    await page.getByRole("button", { name: /^Saved/ }).click();
    await expect(page.getByText("go", { exact: true })).toBeVisible();
  });

  test("the saved filter is empty until something is saved", async ({ page }) => {
    await page.goto("/vocabulary/");
    await page.getByRole("button", { name: /^Saved/ }).click();
    await expect(page.getByText("No saved words yet")).toBeVisible();
  });
});

test.describe("Vocabulary screen", () => {
  test("lists curated words with pronunciation, meaning and example", async ({ page }) => {
    await page.goto("/vocabulary/");
    await expect(page.getByText("blocker", { exact: true })).toBeVisible();
    await expect(page.getByText("/ˈblɒkə(r)/")).toBeVisible();
    await expect(page.getByText("My only blocker is the staging database.")).toBeVisible();
  });

  test("shows an encounter count that starts at zero", async ({ page }) => {
    await page.goto("/vocabulary/");
    await expect(page.getByText("Not encountered in practice yet").first()).toBeVisible();
  });

  test("counts an encounter once the sentence has been practised", async ({ page }) => {
    await page.goto("/learn/?category=meetings&mode=translate");
    await answerTranslate(page, "I have no blockers today");

    await page.goto("/vocabulary/");
    await page.getByRole("button", { name: "Encountered" }).click();
    await expect(page.getByText("blocker", { exact: true })).toBeVisible();
    await expect(page.getByText("Encountered 1 time").first()).toBeVisible();
  });
});
