import { test, expect, type Page } from "@playwright/test";

/**
 * Speech with the Web Speech API mocked.
 *
 * Chromium under Playwright has no microphone and no speech service, so the real API
 * can never reach the success path here. These tests install a stand-in that emits the
 * same events a browser does, which proves the app's handling of them.
 *
 * **What this cannot prove**, and what still needs a human in a real browser:
 * that Chrome's recogniser actually fires these events, that the permission prompt
 * appears and is honoured, that a real microphone is picked up, and how a Thai-accented
 * English sentence is actually transcribed. See the README's speech section.
 */

type MockOptions = {
  /** Transcript to emit on a successful pass. */
  transcript?: string;
  /** Error string to emit instead, using the spec's own names. */
  error?: string;
  /** End the pass with no result and no error, which is what Chrome does on silence. */
  silent?: boolean;
  /** Pretend a voice is installed, so the Listen button is not disabled. */
  withVoice?: boolean;
};

async function mockSpeech(page: Page, options: MockOptions) {
  await page.addInitScript((opts: MockOptions) => {
    if (opts.withVoice) {
      const voice = { lang: "en-US", name: "Mock EN", default: true, localService: true, voiceURI: "m" };
      Object.defineProperty(window.speechSynthesis, "getVoices", { value: () => [voice] });
    }

    class MockRecognition {
      lang = "";
      continuous = false;
      interimResults = false;
      maxAlternatives = 1;
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: { error: string }) => void) | null = null;
      onend: (() => void) | null = null;
      onaudiostart: (() => void) | null = null;

      start() {
        // Asynchronously, exactly as the real API delivers its events.
        setTimeout(() => {
          this.onaudiostart?.();
          if (opts.error) this.onerror?.({ error: opts.error });
          else if (!opts.silent) this.onresult?.({ results: [[{ transcript: opts.transcript ?? "" }]] });
          this.onend?.();
        }, 30);
      }
      stop() {
        this.onend?.();
      }
      abort() {}
    }

    Object.defineProperty(window, "SpeechRecognition", { value: MockRecognition, configurable: true });
    Object.defineProperty(window, "webkitSpeechRecognition", { value: MockRecognition, configurable: true });
  }, options);
}

/** Consents, then runs one recognition pass — two deliberate presses, not one. */
async function speakOnce(page: Page) {
  await page.goto("/learn/?category=daily&mode=speak");
  await expect(page.getByText("Before turning on the microphone")).toBeVisible();
  await page.getByRole("button", { name: "Enable microphone" }).click();

  // Consent alone opens nothing: the learner still has to press to record.
  await expect(page.getByRole("button", { name: "Start speaking" })).toBeVisible();
  await page.getByRole("button", { name: "Start speaking" }).click();
}

test.describe("a working recogniser", () => {
  test("grades a correct transcript and pays XP", async ({ page }) => {
    await mockSpeech(page, { transcript: "where are you going", withVoice: true });
    await speakOnce(page);

    await expect(page.getByRole("button", { name: /^Check/ })).toBeEnabled();
    await page.getByRole("button", { name: /^Check/ }).click();

    await expect(page.getByText("Perfect", { exact: true })).toBeVisible();
    await expect(page.getByText("+10 XP").first()).toBeVisible();
  });

  test("still calls the score transcript similarity, not pronunciation", async ({ page }) => {
    await mockSpeech(page, { transcript: "where are you going", withVoice: true });
    await speakOnce(page);
    await page.getByRole("button", { name: /^Check/ }).click();

    await expect(page.getByText(/Transcript similarity, not pronunciation assessment/)).toBeVisible();
  });

  test("a near miss still passes, because the transcript is only evidence", async ({ page }) => {
    // "wear" for "where" is a homophone the recogniser picks wrongly all the time; the
    // weighted edit distance gives it most of the credit rather than failing outright.
    await mockSpeech(page, { transcript: "wear are you going", withVoice: true });
    await speakOnce(page);
    await page.getByRole("button", { name: /^Check/ }).click();

    await expect(page.getByText("Great", { exact: true })).toBeVisible();
    await expect(page.getByText("+6 XP").first()).toBeVisible();
  });

  test("a badly misheard sentence fails but offers the override", async ({ page }) => {
    await mockSpeech(page, { transcript: "the weather is nice today", withVoice: true });
    await speakOnce(page);
    await page.getByRole("button", { name: /^Check/ }).click();

    await expect(page.getByText("Try Again", { exact: true })).toBeVisible();
    await expect(page.getByText("No XP — that answer was not a pass.")).toBeVisible();
    // Recognition is not the judge: the learner may well have said it correctly.
    await expect(page.getByRole("button", { name: "Recognition misheard me" })).toBeVisible();
  });

  test("the override turns a mishearing into a pass and pays the XP", async ({ page }) => {
    await mockSpeech(page, { transcript: "the weather is nice today", withVoice: true });
    await speakOnce(page);
    await page.getByRole("button", { name: /^Check/ }).click();
    await page.getByRole("button", { name: "Recognition misheard me" }).click();

    await expect(page.getByText("+10 XP").first()).toBeVisible();
  });

  test("stores no audio anywhere", async ({ page }) => {
    await mockSpeech(page, { transcript: "where are you going", withVoice: true });
    await speakOnce(page);
    await page.getByRole("button", { name: /^Check/ }).click();
    await expect(page.getByRole("button", { name: /^Next/ })).toBeVisible();

    // Only the transcript is written down; nothing resembling a recording exists.
    const stores = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve) => {
        const request = indexedDB.open("engthai-trainer");
        request.onsuccess = () => resolve(request.result);
      });
      const rows = await new Promise<unknown[]>((resolve) => {
        const request = db.transaction("attempts", "readonly").objectStore("attempts").getAll();
        request.onsuccess = () => resolve(request.result);
      });
      db.close();
      return JSON.stringify(rows);
    });

    expect(stores).toContain("where are you going");
    expect(stores).not.toMatch(/audio|blob:|data:audio|base64/i);
  });
});

test.describe("every failure falls back to manual practice", () => {
  for (const [error, message] of [
    ["not-allowed", /Microphone access was blocked/],
    ["audio-capture", /No microphone was found/],
    ["network", /needs a network connection/],
  ] as const) {
    test(`${error} is reported and the card stays answerable`, async ({ page }) => {
      await mockSpeech(page, { error, withVoice: true });
      await speakOnce(page);

      await expect(page.getByText(message)).toBeVisible();
      // A dead end would be the real failure here.
      await expect(page.getByRole("button", { name: "I said it correctly" })).toBeVisible();
    });
  }

  test("silence is reported as hearing nothing, not as an error", async ({ page }) => {
    await mockSpeech(page, { silent: true, withVoice: true });
    await speakOnce(page);

    await expect(page.getByText(/Nothing was heard/)).toBeVisible();
    await expect(page.getByRole("button", { name: "I said it correctly" })).toBeVisible();
  });

  test("a blocked microphone still lets the learner finish the card for XP", async ({ page }) => {
    await mockSpeech(page, { error: "not-allowed", withVoice: true });
    await speakOnce(page);
    await page.getByRole("button", { name: "I said it correctly" }).click();

    await expect(page.getByText("+10 XP").first()).toBeVisible();
  });
});

test("the consent panel states what leaves the device before the microphone opens", async ({ page }) => {
  await mockSpeech(page, { transcript: "anything", withVoice: true });
  await page.goto("/learn/?category=daily&mode=speak");

  // Nothing may be recorded before this has been read and accepted.
  await expect(page.getByText(/external speech service/)).toBeVisible();
  await expect(page.getByText(/never records, keeps or uploads audio/)).toBeVisible();
  await expect(page.getByRole("button", { name: /^Check/ })).toBeDisabled();
});
