import { test, expect, type Page } from "@playwright/test";

const CARD_1 = "Where are you going?";

/** Every Workplace sentence, in the order the queue serves them (by id). */
const WORKPLACE_DECK = [
  "i would like to take friday off",
  "i am attaching the report to this email",
  "thanks for the heads up",
  "i will be working from home tomorrow",
  "sorry for the slow reply i was away last week",
];

/**
 * Waits for the graded panel before returning: the submit persists asynchronously, so
 * navigating away the instant Check is clicked can abort the write.
 */
async function answer(page: Page, text: string) {
  await page.getByLabel("Type what you hear, in English").fill(text);
  await page.getByRole("button", { name: /^Check/ }).click();
  await expect(page.getByRole("button", { name: /^Next/ })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/lessons/");
  await expect(page.getByText("Daily Conversation")).toBeVisible();
});

test("lists every category, including the empty ones", async ({ page }) => {
  await expect(page.getByText("Daily Conversation")).toBeVisible();
  await expect(page.getByText("Software Engineering")).toBeVisible();
  await expect(page.getByText("Technical Interviews")).toBeVisible();
  await expect(page.getByText("Not started (2 of 7)")).toBeVisible();
  await expect(
    page.getByText("No sentences yet — import a deck or add your own to start this category.").first(),
  ).toBeVisible();
});

test("shows sentence count, level range and completion for a stocked category", async ({ page }) => {
  // Scoped to the card: three categories hold ten sentences each.
  const daily = page.getByRole("listitem").filter({ hasText: "Daily Conversation" });
  await expect(daily.getByText("10 sentences")).toBeVisible();
  await expect(daily.getByText("A1–B1")).toBeVisible();
  await expect(daily.getByText("0% complete")).toBeVisible();
});

test("hides the answer until it is submitted, when audio is available", async ({ page }) => {
  // The test browser has no installed voices, so dictation would otherwise fall back to
  // showing the sentence. Stub one in to exercise the normal path.
  await page.addInitScript(() => {
    const voice = { lang: "en-US", name: "Test Voice", default: true, localService: true, voiceURI: "t" };
    Object.defineProperty(window.speechSynthesis, "getVoices", { value: () => [voice] });
  });

  await page.goto("/learn/?category=daily&mode=dictation");
  await expect(page.getByText("Card 1 of 10")).toBeVisible();
  await expect(page.getByText(CARD_1)).toHaveCount(0);
});

test("shows the sentence instead when no voice is installed", async ({ page }) => {
  await page.goto("/learn/?category=daily&mode=dictation");

  // Without audio there is nothing to dictate, so the sentence is revealed rather than
  // leaving the card unanswerable — and the reason is stated.
  await expect(page.getByText(/No English voice is installed/)).toBeVisible();
  await expect(page.getByText(CARD_1).first()).toBeVisible();
});

test("completes a dictation card and awards XP", async ({ page }) => {
  await page.getByRole("link", { name: "Start dictation" }).first().click();

  await expect(page.getByText("Card 1 of 10")).toBeVisible();

  await answer(page, "where are you going");

  await expect(page.getByText("Perfect", { exact: true })).toBeVisible();
  await expect(page.getByText("100%")).toBeVisible();
  await expect(page.getByText(CARD_1)).toBeVisible();
  await expect(page.getByText("+10 XP").first()).toBeVisible();
  await expect(page.getByText("🔥 1")).toBeVisible();
  await expect(page.getByText("Goal 1/20 (5%)")).toBeVisible();
});

test("shows word-level feedback for a near miss", async ({ page }) => {
  await page.goto("/learn/?category=daily");
  await answer(page, "where are you");

  await expect(page.getByText("Good", { exact: true })).toBeVisible();
  await expect(page.getByText("75%")).toBeVisible();
});

test("Enter submits and then advances to the next card", async ({ page }) => {
  await page.goto("/learn/?category=daily");

  const field = page.getByLabel("Type what you hear, in English");
  await field.fill("where are you going");
  await field.press("Enter");

  await expect(page.getByText("Perfect", { exact: true })).toBeVisible();

  await page.keyboard.press("Enter");
  await expect(page.getByText("Card 2 of 10")).toBeVisible();
});

test("Alt+H reveals the hint without leaving the answer field", async ({ page }) => {
  await page.goto("/learn/?category=daily");

  const field = page.getByLabel("Type what you hear, in English");
  await field.click();
  await page.keyboard.press("Alt+h");

  await expect(page.getByText("คุณจะไปไหน")).toBeVisible();
  // The shortcut must not steal focus, or the learner cannot keep typing.
  await expect(field).toBeFocused();
});

test("does not award XP twice for the same card", async ({ page }) => {
  await page.goto("/learn/?category=daily");
  await answer(page, "where are you going");
  await expect(page.getByText("+10 XP").first()).toBeVisible();

  await page.getByRole("button", { name: /^Retry/ }).click();
  await answer(page, "where are you going");

  await expect(page.getByText("Already earned XP for this card today.")).toBeVisible();
  await expect(
    page.getByText("Schedule already updated for this card today, so this attempt was practice only."),
  ).toBeVisible();
  // Session total is unchanged.
  await expect(page.getByText("+10 XP").first()).toBeVisible();
});

test("does not award XP again after a reload", async ({ page }) => {
  await page.goto("/learn/?category=daily");
  await answer(page, "where are you going");
  await expect(page.getByText("+10 XP").first()).toBeVisible();

  await page.reload();
  // The passed card is scheduled for tomorrow, so only the nine unseen cards remain.
  await expect(page.getByText("Card 1 of 9")).toBeVisible();
  await expect(page.getByText("Goal 1/20 (5%)")).toBeVisible();
});

test("skipping never counts as a success", async ({ page }) => {
  await page.goto("/learn/?category=daily");
  await page.getByRole("button", { name: /^Skip/ }).click();

  await expect(page.getByText("Card 2 of 10")).toBeVisible();
  await expect(page.getByText("Goal 0/20 (0%)")).toBeVisible();
  await expect(page.getByText("🔥 0")).toBeVisible();

  await page.goto("/lessons/");
  await expect(page.getByText("0% complete").first()).toBeVisible();
});

test("progress survives a reload", async ({ page }) => {
  await page.goto("/learn/?category=daily");
  await answer(page, "where are you going");
  await page.getByRole("button", { name: /^Next/ }).click();
  await answer(page, "i am very hungry");

  await page.goto("/lessons/");
  const daily = page.getByRole("listitem").filter({ hasText: "Daily Conversation" });
  await expect(daily.getByText("20% complete")).toBeVisible();

  await page.reload();
  await expect(daily.getByText("20% complete")).toBeVisible();
});

test("finishes the session and reports the XP earned", async ({ page }) => {
  // Workplace is the smallest stocked category, so a whole queue fits in one test.
  await page.goto("/learn/?category=workplace");

  for (const text of WORKPLACE_DECK) {
    await answer(page, text);
    await page.getByRole("button", { name: /^Next/ }).click();
  }

  await expect(page.getByText("Session complete")).toBeVisible();
  await expect(page.getByText("5 answered")).toBeVisible();
  await expect(page.getByText("XP earned").locator("xpath=following-sibling::p[1]")).toHaveText("50");
});
