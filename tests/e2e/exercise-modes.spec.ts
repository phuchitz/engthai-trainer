import { test, expect, type Page } from "@playwright/test";

const check = (page: Page) => page.getByRole("button", { name: /^Check/ });

test("offers every implemented mode", async ({ page }) => {
  await page.goto("/learn/?category=daily&mode=dictation");
  for (const label of ["Dictation", "Thai to English", "Fill in the Blank", "Sentence Builder", "Speaking"]) {
    await expect(page.getByRole("link", { name: label })).toBeVisible();
  }
});

test.describe("Sentence Builder", () => {
  test("builds the Thai sentence from shuffled tiles", async ({ page }) => {
    await page.goto("/learn/?category=daily&mode=wordOrder");

    // The English prompt is shown; the Thai answer is what must be assembled.
    await expect(page.getByText("Where are you going?")).toBeVisible();

    const pool = page.getByRole("group", { name: "Available words" });
    for (const word of ["คุณ", "จะ", "ไป", "ไหน"]) {
      await pool.getByRole("button", { name: word, exact: true }).click();
    }

    await check(page).click();
    await expect(page.getByText("Perfect", { exact: true })).toBeVisible();
    await expect(page.getByText("+10 XP").first()).toBeVisible();
  });

  test("tapping a placed tile returns it to the pool", async ({ page }) => {
    await page.goto("/learn/?category=daily&mode=wordOrder");

    const pool = page.getByRole("group", { name: "Available words" });
    await pool.getByRole("button", { name: "คุณ", exact: true }).click();
    await expect(pool.getByRole("button", { name: "คุณ", exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: "Remove คุณ" }).click();
    await expect(pool.getByRole("button", { name: "คุณ", exact: true })).toHaveCount(1);
  });

  test("rejects the wrong order, with no partial credit for Thai", async ({ page }) => {
    await page.goto("/learn/?category=daily&mode=wordOrder");

    const pool = page.getByRole("group", { name: "Available words" });
    for (const word of ["ไหน", "ไป", "จะ", "คุณ"]) {
      await pool.getByRole("button", { name: word, exact: true }).click();
    }

    await check(page).click();
    await expect(page.getByText("Try Again", { exact: true })).toBeVisible();
  });

  test("uses a separate schedule from the English modes", async ({ page }) => {
    // Pass the English card first.
    await page.goto("/learn/?category=daily&mode=dictation");
    await page.getByLabel("Type what you hear, in English").fill("where are you going");
    await check(page).click();
    await expect(page.getByText("+10 XP").first()).toBeVisible();

    // The Thai card for the same sentence is untouched, so it still earns XP.
    await page.goto("/learn/?category=daily&mode=wordOrder");
    const pool = page.getByRole("group", { name: "Available words" });
    for (const word of ["คุณ", "จะ", "ไป", "ไหน"]) {
      await pool.getByRole("button", { name: word, exact: true }).click();
    }
    await check(page).click();
    await expect(page.getByText("+10 XP").first()).toBeVisible();
  });
});

test.describe("Fill in the Blank", () => {
  test("scores only the missing words", async ({ page }) => {
    await page.goto("/learn/?category=software&mode=fillBlank");

    const blanks = page.getByRole("textbox", { name: /^Blank \d+ of \d+$/ });
    await expect(blanks).toHaveCount(2);
    await expect(page.getByText("2 words are missing. Only these are scored.")).toBeVisible();

    await blanks.nth(0).fill("let's");
    await blanks.nth(1).fill("before");
    await check(page).click();

    await expect(page.getByText("Only the missing words were scored.", { exact: true })).toBeVisible();
    // Half the blanks are wrong, so this must land far below the ~83% a whole-sentence
    // grade would have produced.
    await expect(page.getByText("Try Again", { exact: true })).toBeVisible();
  });

  test("passes when every blank is right", async ({ page }) => {
    await page.goto("/learn/?category=software&mode=fillBlank");

    const blanks = page.getByRole("textbox", { name: /^Blank \d+ of \d+$/ });
    await blanks.nth(0).fill("let's");
    await blanks.nth(1).fill("after");
    await check(page).click();

    await expect(page.getByText("Perfect", { exact: true })).toBeVisible();
  });
});

test.describe("Thai to English", () => {
  test("accepts an authored alternative", async ({ page }) => {
    await page.goto("/learn/?category=meetings&mode=translate");

    await expect(page.getByText("วันนี้ผมไม่มีอะไรติดขัด")).toBeVisible();
    await page.getByLabel("Translate this sentence into English").fill("I have no blockers today");
    await check(page).click();

    await expect(page.getByText("Perfect", { exact: true })).toBeVisible();
    await expect(page.getByText("100%")).toBeVisible();
  });
});

test.describe("Speaking", () => {
  test("requires explicit consent before touching the microphone", async ({ page }) => {
    await page.goto("/learn/?category=daily&mode=speak");

    await expect(page.getByText("Before turning on the microphone")).toBeVisible();
    await expect(page.getByText(/external speech service/)).toBeVisible();
    await expect(page.getByText(/never records, keeps or uploads audio/)).toBeVisible();
    await expect(page.getByText(/transcript similarity/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Enable microphone" })).toBeVisible();
    // Nothing can be submitted until there is something to submit.
    await expect(check(page)).toBeDisabled();
  });

  test("falls back to manual practice when the learner declines the microphone", async ({ page }) => {
    await page.goto("/learn/?category=daily&mode=speak");
    await page.getByRole("button", { name: "Practise without the microphone instead" }).click();

    await expect(page.getByText("Transcription unavailable")).toBeVisible();
    await expect(page.getByText("Say this out loud")).toBeVisible();
    await expect(page.getByRole("button", { name: "I said it correctly" })).toBeVisible();
  });

  test("falls back to manual practice on a browser without recognition", async ({ page }) => {
    await page.addInitScript(() => {
      // Firefox has no speech recognition at all.
      Object.defineProperty(window, "SpeechRecognition", { value: undefined });
      Object.defineProperty(window, "webkitSpeechRecognition", { value: undefined });
    });
    await page.goto("/learn/?category=daily&mode=speak");

    await expect(page.getByText("Transcription unavailable")).toBeVisible();
    await expect(page.getByText(/Chrome and Edge can; Firefox cannot/)).toBeVisible();
    await expect(page.getByRole("button", { name: "I said it correctly" })).toBeVisible();
  });

  test("self-assessment awards XP and labels the score as a transcript", async ({ page }) => {
    await page.goto("/learn/?category=daily&mode=speak");
    await page.getByRole("button", { name: "Practise without the microphone instead" }).click();
    await page.getByRole("button", { name: "I said it correctly" }).click();

    // Exact: the disclaimer below also contains the word "perfectly".
    await expect(page.getByText("Perfect", { exact: true })).toBeVisible();
    await expect(page.getByText(/Transcript similarity, not pronunciation assessment/)).toBeVisible();
    await expect(page.getByText("+10 XP").first()).toBeVisible();
  });

  test("a struggled attempt earns nothing", async ({ page }) => {
    await page.goto("/learn/?category=daily&mode=speak");
    await page.getByRole("button", { name: "Practise without the microphone instead" }).click();
    await page.getByRole("button", { name: "I struggled with it" }).click();

    await expect(page.getByText("Try Again", { exact: true })).toBeVisible();
    await expect(page.getByText("No XP — that answer was not a pass.")).toBeVisible();
  });
});

test("every mode offers hint, skip and replay with visible shortcuts", async ({ page }) => {
  for (const mode of ["dictation", "translate", "fillBlank", "wordOrder", "speak"]) {
    await page.goto(`/learn/?category=daily&mode=${mode}`);
    await expect(page.getByRole("button", { name: /^Hint/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Skip/ })).toBeVisible();
    await expect(page.getByText("Alt+H").first()).toBeVisible();
    await expect(page.getByText("Alt+S").first()).toBeVisible();
    await expect(page.getByText("Alt+P").first()).toBeVisible();
  }
});
