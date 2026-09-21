import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

/**
 * Contrast is measured, not eyeballed. Every colour pair the UI can actually put
 * together has to clear WCAG AA in both themes, and a token nudged for looks that
 * drops a pair below the line fails here rather than in someone's eyes.
 */
const css = readFileSync("src/app/globals.css", "utf8");

function tokens(start: string): Record<string, string> {
  const from = css.indexOf(start);
  expect(from, `missing block ${start}`).toBeGreaterThanOrEqual(0);
  const body = css.slice(from, css.indexOf("}", from));
  return Object.fromEntries([...body.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})/g)].map((m) => [m[1], m[2]]));
}

function luminance(hex: string): number {
  const channels = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

const THEMES = {
  light: tokens(":root {"),
  dark: tokens(':root[data-theme="dark"] {'),
};

const SURFACES = ["background", "surface", "surface-muted"] as const;
/** Colours that carry words, so the 4.5 body-text threshold applies. */
const TEXT = ["foreground", "muted", "success", "danger", "warning"] as const;

describe.each(Object.entries(THEMES))("%s theme", (_name, theme) => {
  it("defines every token the other theme defines", () => {
    expect(Object.keys(theme).sort()).toEqual(Object.keys(THEMES.light).sort());
  });

  it.each(TEXT.flatMap((t) => SURFACES.map((s) => [t, s] as const)))(
    "%s on %s reaches AA for body text",
    (text, surface) => {
      expect(contrast(theme[text], theme[surface])).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(SURFACES)("accent is distinguishable on %s", (surface) => {
    // The accent is a fill, an icon and a focus ring, so the 3.0 non-text bar applies.
    expect(contrast(theme.accent, theme[surface])).toBeGreaterThanOrEqual(3);
  });

  it("keeps text on the accent readable", () => {
    expect(contrast(theme["accent-foreground"], theme.accent)).toBeGreaterThanOrEqual(4.5);
  });
});

it("the dark palette really is darker", () => {
  expect(luminance(THEMES.dark.background)).toBeLessThan(luminance(THEMES.light.background));
});

it("the reduced-motion escape hatch is still in place", () => {
  expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
});

it("keyboard focus is visible even where an outline was reset", () => {
  // Element selectors outrank Tailwind's `outline-none` utility; a :where() wrapper
  // would not, so the rule has to keep its specificity.
  expect(css).toMatch(/button:focus-visible/);
  expect(css).toMatch(/input:focus-visible/);
  expect(css).toMatch(/outline: 2px solid var\(--accent\)/);
});
