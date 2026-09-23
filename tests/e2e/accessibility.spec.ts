import { test, expect, type Page } from "@playwright/test";

const ROUTES = [
  { path: "/", heading: "Dashboard" },
  { path: "/lessons/", heading: "Lessons" },
  { path: "/learn/?category=daily&mode=translate", heading: "Learn" },
  { path: "/review/", heading: "Review" },
  { path: "/vocabulary/", heading: "Vocabulary" },
  { path: "/data/", heading: "Import / Export" },
  { path: "/settings/", heading: "Settings" },
];

/** The element that reaches furthest past the viewport, so a failure names a culprit. */
async function overflow(page: Page) {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    let worst = { tag: "", width: 0, right: 0 };
    for (const el of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
      const box = el.getBoundingClientRect();
      if (box.width === 0 && box.height === 0) continue;
      if (box.right <= width + 1) continue;
      if (box.right > worst.right) {
        worst = {
          tag: `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)}`,
          width: Math.round(box.width),
          right: Math.round(box.right),
        };
      }
    }
    return { scrollWidth: document.documentElement.scrollWidth, worst };
  });
}

test.describe("No horizontal overflow", () => {
  for (const size of [
    { name: "mobile 375", width: 375, height: 812 },
    { name: "small phone 320", width: 320, height: 640 },
    { name: "desktop 1280", width: 1280, height: 800 },
  ]) {
    test(size.name, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      for (const route of ROUTES) {
        await page.goto(route.path);
        await expect(page.getByRole("heading", { name: route.heading, level: 1 })).toBeVisible();
        const measured = await overflow(page);
        expect(measured.scrollWidth, `${route.path} ${JSON.stringify(measured.worst)}`).toBeLessThanOrEqual(
          size.width,
        );
      }
    });
  }
});

test.describe("Landmarks and headings", () => {
  test("every screen has one main landmark and one h1", async ({ page }) => {
    for (const route of ROUTES) {
      await page.goto(route.path);
      await expect(page.getByRole("main"), route.path).toHaveCount(1);
      await expect(page.locator("h1"), route.path).toHaveCount(1);
      await expect(page.locator("h1"), route.path).toContainText(route.heading);
    }
  });

  test("the skip link is the first thing a keyboard reaches and it works", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");

    const focused = page.locator(":focus");
    await expect(focused).toHaveText("Skip to content");
    // sr-only until focused, then genuinely visible rather than a 1px sliver.
    const box = await focused.boundingBox();
    expect(box!.width).toBeGreaterThan(60);
    expect(box!.height).toBeGreaterThan(20);

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main$/);
  });

  test("the current page is marked for assistive technology", async ({ page }) => {
    await page.goto("/lessons/");
    await expect(
      page.getByRole("navigation").getByRole("link", { name: "Lessons", exact: true }).first(),
    ).toHaveAttribute("aria-current", "page");
  });
});

test.describe("Visible keyboard focus", () => {
  test("the first tab stop draws an outline at least 2px wide", async ({ page }) => {
    await page.goto("/lessons/");
    await page.keyboard.press("Tab");

    const outline = await page.evaluate(() => {
      const style = getComputedStyle(document.activeElement as HTMLElement);
      return { width: style.outlineWidth, style: style.outlineStyle };
    });
    expect(parseFloat(outline.width)).toBeGreaterThanOrEqual(2);
    expect(outline.style).not.toBe("none");
  });

  test("the outline rule outranks the outline-none utility on text fields", async ({ page }) => {
    await page.goto("/learn/?category=daily&mode=translate");
    await page.locator("#exercise-answer").waitFor();

    // Which declaration wins is the thing at risk here, and the cascade can be asked
    // directly: :focus-visible is a heuristic that a test cannot reliably trigger.
    const winner = await page.evaluate(() => {
      const input = document.querySelector("#exercise-answer")!;
      let best: { specificity: number; width: string } | null = null;
      for (const sheet of Array.from(document.styleSheets)) {
        let rules: CSSRule[];
        try {
          rules = Array.from(sheet.cssRules);
        } catch {
          continue;
        }
        for (const rule of rules) {
          if (!(rule instanceof CSSStyleRule)) continue;
          const width = rule.style.getPropertyValue("outline-width");
          const shorthand = rule.style.getPropertyValue("outline");
          if (!width && !shorthand) continue;
          const selector = rule.selectorText.replace(/:focus-visible/g, "");
          const matches = selector.split(",").some((s) => {
            try {
              return input.matches(s.trim());
            } catch {
              return false;
            }
          });
          if (!matches) continue;
          // Element+pseudo-class beats a single class; that is the whole point.
          const specificity = rule.selectorText.includes(":focus-visible") ? 2 : 1;
          if (!best || specificity >= best.specificity) {
            best = { specificity, width: shorthand || width };
          }
        }
      }
      return best;
    });

    expect(winner).not.toBeNull();
    expect(winner!.specificity).toBe(2);
    expect(winner!.width).toContain("2px");
  });
});

test.describe("Answer feedback is announced", () => {
  test("a graded answer is spoken, with the score and the wrong words", async ({ page }) => {
    await page.goto("/learn/?category=daily&mode=translate");
    await expect(page.getByText(/Card 1 of/)).toBeVisible();

    const live = page.locator('[role="status"][aria-live="polite"]');
    // Mounted and empty before grading: a live region inserted at the same moment as
    // its text is routinely missed by screen readers.
    await expect(live).toHaveCount(1);
    await expect(live).toHaveText("");

    await page.locator("#exercise-answer").fill("definitely not the answer");
    await page.getByRole("button", { name: /^Check/ }).click();
    // Grading persists asynchronously; reading the region before it settles is a race.
    await expect(page.getByRole("button", { name: /^Next/ })).toBeVisible();

    const text = (await live.textContent()) ?? "";
    expect(text).toMatch(/percent\./);
    expect(text).toMatch(/Perfect|Great|Good|Try Again/);
    // The visible diff is a colour, so the announcement has to name the words.
    expect(text).toMatch(/Missing|Extra|should be/);
    expect(text).toContain("Expected:");
  });

  test("a correct answer announces the pass and the XP", async ({ page }) => {
    await page.goto("/learn/?category=daily&mode=translate");
    await expect(page.getByText(/Card 1 of/)).toBeVisible();

    // Look up the English for whichever card came up, from the learner's own database.
    // Every Thai string on the page is offered, because the page header carries one too.
    const thai = (await page.locator("main p[lang='th']").allTextContents()).map((t) => t.trim());
    expect(thai.length).toBeGreaterThan(0);

    const english = await page.evaluate(async (candidates) => {
      const db = await new Promise<IDBDatabase>((resolve) => {
        const request = indexedDB.open("engthai-trainer");
        request.onsuccess = () => resolve(request.result);
      });
      const rows = await new Promise<{ en: string; th: string }[]>((resolve) => {
        const request = db.transaction("sentences", "readonly").objectStore("sentences").getAll();
        request.onsuccess = () => resolve(request.result);
      });
      db.close();
      return rows.find((r) => candidates.includes(r.th.trim()))?.en ?? "";
    }, thai);
    expect(english).not.toBe("");

    await page.locator("#exercise-answer").fill(english);
    await page.getByRole("button", { name: /^Check/ }).click();

    const live = page.locator('[role="status"][aria-live="polite"]');
    await expect(live).toContainText("Every word is correct.");
    await expect(live).toContainText("XP");
  });
});

test.describe("Real states, not placeholders", () => {
  test("no screen still carries a session placeholder", async ({ page }) => {
    for (const route of ROUTES) {
      await page.goto(route.path);
      await expect(page.getByText(/Coming in session \d/), route.path).toHaveCount(0);
      await expect(page.getByText(/^TODO/), route.path).toHaveCount(0);
      await expect(page.getByText(/Placeholder/i), route.path).toHaveCount(0);
    }
  });

  test("an unsupported feature is reported, not hidden", async ({ page }) => {
    // The test browser has no speech synthesis voices, which is exactly the case the
    // learner's browser might be in. It has to say so and still be usable.
    await page.goto("/learn/?category=daily&mode=dictation");
    await expect(page.getByText(/no speech synthesis|voice is installed/i)).toBeVisible();
    // And it degrades rather than dead-ends: with no audio to dictate, the sentence is
    // shown, so the exercise is still answerable.
    await expect(page.getByText(/The sentence is shown instead/)).toBeVisible();
    await page.locator("#exercise-answer").fill("anything");
    await expect(page.getByRole("button", { name: /^Check/ })).toBeEnabled();
  });
});
