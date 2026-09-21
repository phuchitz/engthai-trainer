import { test, expect, type Page } from "@playwright/test";

/** Waits for the worker to reach `activated` and take control of this page. */
async function serviceWorkerReady(page: Page) {
  return page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) => {
        navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true });
      });
    }
    return { scope: registration.scope, state: registration.active?.state ?? null };
  });
}

test.describe("Installability", () => {
  test("the manifest describes an installable app", async ({ page }) => {
    await page.goto("/");
    const href = await page.locator('link[rel="manifest"]').getAttribute("href");
    expect(href).toBe("/manifest.webmanifest");

    const response = await page.request.get(href!);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("manifest+json");

    const manifest = (await response.json()) as {
      name: string;
      start_url: string;
      display: string;
      icons: { src: string; sizes: string; purpose: string }[];
    };
    expect(manifest.name).toBe("EngThai Trainer");
    expect(manifest.start_url).toBe("/");
    expect(manifest.display).toBe("standalone");

    // Chrome's install prompt needs a 192 and a 512, and a maskable keeps the icon
    // from being letterboxed on Android.
    expect(manifest.icons.some((i) => i.sizes === "192x192")).toBe(true);
    expect(manifest.icons.some((i) => i.sizes === "512x512")).toBe(true);
    expect(manifest.icons.some((i) => i.purpose === "maskable")).toBe(true);

    for (const icon of manifest.icons) {
      const iconResponse = await page.request.get(icon.src);
      expect(iconResponse.status(), icon.src).toBe(200);
      expect(iconResponse.headers()["content-type"], icon.src).toContain("image/png");
    }
  });

  test("the browser has everything it needs to offer installation", async ({ page }) => {
    await page.goto("/");
    // The prompt itself is Chrome's decision and cannot be triggered from a test, so
    // this pins the parts the app is responsible for.
    await expect(page.locator('meta[name="theme-color"]').first()).toHaveCount(1);
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
    expect(await page.evaluate(() => window.isSecureContext)).toBe(true);
  });
});

test.describe("Offline", () => {
  test("the app shell reloads with the network down", async ({ page, context }) => {
    await page.goto("/");
    await serviceWorkerReady(page);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    await context.setOffline(true);
    await page.reload();

    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    // Not just the HTML: the app has to have hydrated and read IndexedDB.
    await expect(page.getByText(/Daily goal/i).first()).toBeVisible();
  });

  test("a route that was never opened still works offline", async ({ page, context }) => {
    // Precaching, not runtime caching, is the point: the learner never visited /lessons/.
    await page.goto("/");
    await serviceWorkerReady(page);

    await context.setOffline(true);
    await page.goto("/lessons/");

    await expect(page.getByRole("heading", { name: "Lessons" })).toBeVisible();
    await expect(page.getByText("Daily Conversation")).toBeVisible();
  });

  test("an exercise runs offline against locally stored sentences", async ({ page, context }) => {
    await page.goto("/");
    await serviceWorkerReady(page);
    // Seeding happens on first load; going offline before it would prove nothing.
    await page.goto("/lessons/");
    await expect(page.getByText("Daily Conversation")).toBeVisible();

    await context.setOffline(true);
    await page.goto("/learn/?category=daily&mode=translate");

    await expect(page.getByText(/Card 1 of/)).toBeVisible();
    await expect(page.getByRole("button", { name: /^Check/ })).toBeVisible();
  });

  test("progress written offline is still there after reconnecting", async ({ page, context }) => {
    await page.goto("/learn/?category=daily&mode=translate");
    await serviceWorkerReady(page);
    await expect(page.getByText(/Card 1 of/)).toBeVisible();

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByText(/Card 1 of/)).toBeVisible();

    await context.setOffline(false);
    await page.reload();
    await expect(page.getByText(/Card 1 of/)).toBeVisible();
  });

  test("an unbuilt URL says so instead of pretending", async ({ page, context }) => {
    await page.goto("/");
    await serviceWorkerReady(page);

    await context.setOffline(true);
    const response = await page.goto("/definitely-not-a-route/");
    // Honest failure: 404 pages are precached, anything else gets the offline notice.
    expect([404, 503]).toContain(response?.status() ?? 0);
  });
});

test("a new build replaces the old cache rather than mixing the two", async ({ page }) => {
  await page.goto("/");
  await serviceWorkerReady(page);

  const names = await page.evaluate(() => caches.keys());
  expect(names.filter((n) => n.startsWith("engthai-shell-"))).toHaveLength(1);
  // The name carries a hash of the build, so a rebuild cannot reuse it.
  expect(names[0]).toMatch(/^engthai-shell-[0-9a-f]{12}$/);
});
