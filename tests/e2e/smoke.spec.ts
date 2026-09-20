import { test, expect } from "@playwright/test";

const SCREENS = [
  { path: "/", heading: "Dashboard" },
  { path: "/lessons/", heading: "Lessons" },
  { path: "/learn/", heading: "Learn" },
  { path: "/review/", heading: "Review" },
  { path: "/vocabulary/", heading: "Vocabulary" },
  { path: "/data/", heading: "Import / Export" },
  { path: "/settings/", heading: "Settings" },
];

for (const screen of SCREENS) {
  test(`${screen.heading} renders`, async ({ page }) => {
    await page.goto(screen.path);
    await expect(page.getByRole("heading", { level: 1, name: screen.heading })).toBeVisible();
  });
}

test("sidebar navigates between screens and marks the current page", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main" }).first();
  await nav.getByRole("link", { name: "Vocabulary" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Vocabulary" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Vocabulary" })).toHaveAttribute("aria-current", "page");
});
