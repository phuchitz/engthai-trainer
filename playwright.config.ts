import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "on-first-retry",
    /**
     * Every test starts as a learner who has already answered the front door.
     *
     * A build compiled with a Google client ID opens on the sign-in screen, so without
     * this each of the two hundred tests below would be testing that screen rather than
     * the thing it names. Tests that *are* about the front door opt out with
     * `test.use({ storageState: { cookies: [], origins: [] } })`.
     *
     * Only a preference is seeded. IndexedDB is untouched, so every test still starts
     * with an empty library and seeds it from scratch.
     */
    storageState: "./tests/e2e/returning-learner.json",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx serve out -l ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
