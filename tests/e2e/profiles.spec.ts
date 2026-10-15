import { test, expect, type Page } from "@playwright/test";

/**
 * Profiles are a device convenience, not an account system. What has to hold is that two
 * people sharing a laptop never see each other's schedule, and that the passcode does
 * exactly what the screen says it does — no more.
 */

const answerOne = async (page: Page) => {
  await page.goto("/learn/?category=daily&mode=translate");
  await page.getByLabel("Translate this sentence into English").fill("where are you going");
  await page.getByRole("button", { name: /^Check/ }).click();
  await expect(page.getByRole("button", { name: /^Next/ })).toBeVisible();
};

const databases = (page: Page) =>
  page.evaluate(async () =>
    (await indexedDB.databases())
      .map((d) => d.name)
      .filter(Boolean)
      .sort(),
  );

async function addProfile(page: Page, name: string) {
  await page.goto("/settings/");
  await page.getByRole("button", { name: "Add a profile" }).click();
  await page.getByLabel("Name for the new profile").fill(name);
  await page.getByRole("button", { name: "Create and switch" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
  // The heading renders before the new database exists; the goal line needs it open.
  await expect(page.getByText(/\d+ \/ \d+ sentences/)).toBeVisible();
}

async function setPasscode(page: Page, digits: string) {
  await page.goto("/settings/");
  await page.getByRole("button", { name: /^Set a passcode$/ }).click();
  await page.getByLabel(/digits/).fill(digits);
  await page.getByRole("button", { name: "Set passcode" }).click();
  await expect(page.getByText("Passcode set")).toBeVisible();
}

test.describe("One learner notices nothing", () => {
  test("opens straight into the app, with no picker and no sign-in", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
    await expect(page.getByText("Who is studying?")).toHaveCount(0);
  });

  test("keeps using the database it already had", async ({ page }) => {
    // Renaming an IndexedDB database is impossible, so the first profile keeps the
    // original name and nothing is migrated.
    await page.goto("/");
    await expect(page.getByText("0 / 20 sentences")).toBeVisible();
    expect(await databases(page)).toEqual(["engthai-trainer"]);
  });

  test("says in Settings that a profile is not an account", async ({ page }) => {
    await page.goto("/settings/");
    await expect(page.getByRole("heading", { name: "Profiles" })).toBeVisible();
    await expect(page.getByText(/Not an account: nothing is sent anywhere/)).toBeVisible();
  });
});

test.describe("Two people, one device", () => {
  test("a new profile starts from nothing", async ({ page }) => {
    await answerOne(page);
    await page.goto("/");
    await expect(page.getByText("1 / 20 sentences")).toBeVisible();

    await addProfile(page, "Nok");

    // Its own deck, its own schedule, none of the first profile's history.
    await expect(page.getByText("0 / 20 sentences")).toBeVisible();
    await expect(page.getByText("First sentence")).toBeVisible();
  });

  test("gives the new profile its own database", async ({ page }) => {
    await addProfile(page, "Nok");
    const names = await databases(page);

    expect(names).toHaveLength(2);
    expect(names).toContain("engthai-trainer");
    expect(names.some((n) => n?.startsWith("engthai-trainer--"))).toBe(true);
  });

  test("switching back finds the first profile's progress untouched", async ({ page }) => {
    await answerOne(page);
    await addProfile(page, "Nok");
    await expect(page.getByText("0 / 20 sentences")).toBeVisible();

    await page.goto("/settings/");
    await page.getByRole("button", { name: "Switch to" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
    await expect(page.getByText("1 / 20 sentences")).toBeVisible();
  });

  test("studying as one profile leaves the other alone", async ({ page }) => {
    await addProfile(page, "Nok");
    await answerOne(page);

    await page.goto("/settings/");
    await page.getByRole("button", { name: "Switch to" }).click();
    await expect(page.getByText("0 / 20 sentences")).toBeVisible();
  });

  test("refuses a duplicate name rather than creating two of the same person", async ({ page }) => {
    await addProfile(page, "Nok");
    await page.goto("/settings/");
    await page.getByRole("button", { name: "Add a profile" }).click();
    await page.getByLabel("Name for the new profile").fill("nok");
    await page.getByRole("button", { name: "Create and switch" }).click();

    await expect(page.getByText(/There is already a profile called/)).toBeVisible();
  });

  test("signing out shows the picker, and choosing comes back in", async ({ page }) => {
    await addProfile(page, "Nok");
    await page.goto("/settings/");
    await page.getByRole("button", { name: "Sign out" }).click();

    // Signing out is a request to leave the signed-in-or-not decision, so on a build
    // with sign-in configured it lands back at the front door. The picker is one step on.
    // Wait for the gate to settle first: signing out reloads, and asking what is on
    // screen before that lands answers about the page being left.
    await expect(page.getByRole("heading", { name: /Who is studying\?|EngThai Trainer/ })).toBeVisible();

    const chooseInstead = page.getByRole("button", { name: "Choose a profile instead" });
    if ((await chooseInstead.count()) > 0) await chooseInstead.click();

    await expect(page.getByRole("heading", { name: "Who is studying?" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Nok/ })).toBeVisible();

    await page.getByRole("button", { name: /Nok/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
  });
});

test.describe("The passcode", () => {
  test("locks the profile on the next load", async ({ page }) => {
    await setPasscode(page, "2468");
    await page.getByRole("button", { name: "Lock now" }).click();

    await expect(page.getByLabel("Enter passcode")).toBeVisible();
    // The app behind it must not be on screen at all.
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toHaveCount(0);
  });

  test("says plainly that it is not encryption", async ({ page }) => {
    await setPasscode(page, "2468");
    await page.getByRole("button", { name: "Lock now" }).click();

    await expect(page.getByText(/not encryption/)).toBeVisible();
    await expect(page.getByText(/developer tools or your exported backup file/)).toBeVisible();
  });

  test("rejects the wrong digits and opens on the right ones", async ({ page }) => {
    await setPasscode(page, "2468");
    await page.getByRole("button", { name: "Lock now" }).click();

    await page.getByLabel("Enter passcode").fill("1111");
    await page.getByRole("button", { name: "Unlock" }).click();
    await expect(page.getByText("That is not the passcode.")).toBeVisible();

    await page.getByLabel("Enter passcode").fill("2468");
    await page.getByRole("button", { name: "Unlock" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
  });

  test("stays unlocked for the rest of the tab, across navigation", async ({ page }) => {
    await setPasscode(page, "2468");
    await page.getByRole("button", { name: "Lock now" }).click();
    await page.getByLabel("Enter passcode").fill("2468");
    await page.getByRole("button", { name: "Unlock" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();

    await page.goto("/lessons/");
    await expect(page.getByRole("heading", { level: 1, name: "Lessons" })).toBeVisible();
    await expect(page.getByLabel("Enter passcode")).toHaveCount(0);
  });

  test("locks again in a new tab, because unlocking is per session", async ({ page, context }) => {
    await setPasscode(page, "2468");

    const second = await context.newPage();
    await second.goto("/");
    await expect(second.getByLabel("Enter passcode")).toBeVisible();
    await second.close();
  });

  test("never writes the digits down", async ({ page }) => {
    await setPasscode(page, "2468");

    const stored = await page.evaluate(() => localStorage.getItem("engthai.profiles"));
    expect(stored).toBeTruthy();
    expect(stored).not.toContain("2468");
    expect(stored).toContain("PBKDF2-SHA256");
  });

  test("can be removed when forgotten, after typing the profile name", async ({ page }) => {
    // Nothing is encrypted, so a forgotten passcode would cost the learner their own
    // progress for no gain. The name is the same speed bump "delete everything" uses.
    await page.goto("/settings/");
    await page.getByRole("button", { name: "Rename" }).click();
    await page.getByLabel(/^Name for/).fill("Ben");
    await page.getByRole("button", { name: "Save" }).click();

    await setPasscode(page, "2468");
    await page.getByRole("button", { name: "Lock now" }).click();
    await page.getByRole("button", { name: "I forgot my passcode" }).click();

    const remove = page.getByRole("button", { name: "Remove passcode" });
    await expect(remove).toBeDisabled();

    await page.getByLabel(/Type Ben to confirm/).fill("Ben");
    await remove.click();

    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
  });

  test("locks only the profile it belongs to", async ({ page }) => {
    await setPasscode(page, "2468");
    await addProfile(page, "Nok");

    // Nok has no passcode, so Nok opens straight in.
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
    await expect(page.getByLabel("Enter passcode")).toHaveCount(0);
  });
});

test.describe("Deleting a profile", () => {
  test("takes its database with it", async ({ page }) => {
    await addProfile(page, "Nok");
    expect(await databases(page)).toHaveLength(2);

    await page.goto("/settings/");
    // Scoped to the profile list itself: the Google disclosure renders lists too.
    const profiles = page.locator("section[aria-labelledby='profiles-heading'] > ul > li");
    await expect(profiles).toHaveCount(2);

    // Nok is the active profile, so the only Delete on screen belongs to the other one.
    await page.getByRole("button", { name: "Delete" }).first().click();
    await page.getByLabel(/to confirm/).fill("Me");
    await page.getByRole("button", { name: "Delete this profile" }).click();

    await expect(profiles).toHaveCount(1);
    await expect(profiles).toContainText("Nok");
    expect(await databases(page)).toEqual([expect.stringContaining("engthai-trainer--")]);
  });

  test("will not delete the only profile there is", async ({ page }) => {
    await page.goto("/settings/");
    await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(0);
  });
});

/**
 * Whether this build was compiled with a client ID.
 *
 * `NEXT_PUBLIC_*` is inlined at build time, so a developer with a `.env.local` and CI
 * without one are testing genuinely different apps. These tests assert what must hold in
 * **either** case rather than pinning whichever the machine happens to have — a suite
 * that passes only on an unconfigured build is a suite that stops running the moment
 * someone configures one.
 */
async function googleConfigured(page: Page): Promise<boolean> {
  await page.goto("/settings/");
  return (await page.getByText("Google sign-in is not set up in this build").count()) === 0;
}

test.describe("Google sign-in", () => {
  // These are the tests that *are* about the front door, so they meet it unanswered.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("shows exactly one coherent state, never a button that cannot work", async ({ page }) => {
    const configured = await googleConfigured(page);

    if (configured) {
      // Configured: the disclosure comes first, and no button before consent.
      await expect(page.getByText("Before signing in with Google")).toBeVisible();
      await expect(page.getByText(/not a sync service and not a lock/)).toBeVisible();
    } else {
      await expect(page.getByText("Google sign-in is not set up in this build")).toBeVisible();
      await expect(page.getByText(/your own Google Cloud project/)).toBeVisible();
    }

    // Either way, nothing offers a sign-in that has not been consented to.
    await expect(page.locator('iframe[src*="accounts.google.com"]')).toHaveCount(0);
  });

  test("leaves the local profile flow completely intact", async ({ page }) => {
    const configured = await googleConfigured(page);
    if (configured) {
      // The front door stands between a fresh device and the app, so step past it.
      await page.getByRole("button", { name: "Continue without signing in" }).click();
      await page.goto("/settings/");
    }
    await expect(page.getByRole("button", { name: "Add a profile" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Sign out" })).toBeEnabled();
  });

  test("a fresh device opens on sign-in when it is configured, and on the app when it is not", async ({
    page,
  }) => {
    const configured = await googleConfigured(page);
    await page.goto("/");

    if (configured) {
      // What "login on the first page" means: the app shell is not even in the DOM.
      await expect(page.getByText(/Sign in to open your progress on this device/)).toBeVisible();
      await expect(page.locator("[data-app-shell]")).toHaveCount(0);
    } else {
      await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
    }
  });

  test("never traps anyone behind a sign-in they cannot complete", async ({ page }) => {
    // Google could be unreachable, or the learner may simply not want an account. Their
    // data is on their own device either way.
    if (!(await googleConfigured(page))) test.skip();

    await page.goto("/");
    await page.getByRole("button", { name: "Continue without signing in" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();

    // And the choice sticks, rather than asking again on every load.
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
  });

  test("contacts Google nowhere on an ordinary load", async ({ page }) => {
    // The app is offline-first and the script is not in the layout. Nothing may reach
    // accounts.google.com until someone has read the disclosure and agreed.
    const external: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (!url.hostname.startsWith("127.0.0.1") && url.hostname !== "localhost") external.push(url.href);
    });

    await page.goto("/");
    await page.goto("/settings/");
    await page.goto("/learn/?category=daily&mode=translate");

    expect(external).toEqual([]);
  });

  test("stores nothing resembling a Google session", async ({ page }) => {
    await page.goto("/settings/");
    const stored = await page.evaluate(() => JSON.stringify(localStorage));

    expect(stored).not.toMatch(/googleConsent/);
    expect(stored).not.toMatch(/credential|id_token|access_token/i);
  });
});
