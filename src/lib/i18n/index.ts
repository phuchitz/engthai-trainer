import { STRINGS, type StringKey } from "./strings";

export { STRINGS };
export type { StringKey, Phrase } from "./strings";

export const LANGUAGES = ["en", "th"] as const;
export type UiLanguage = (typeof LANGUAGES)[number];
export const DEFAULT_LANGUAGE: UiLanguage = "en";

export function isUiLanguage(value: unknown): value is UiLanguage {
  return value === "en" || value === "th";
}

export type Params = Record<string, string | number>;

/**
 * Looks up a phrase and fills its `{placeholders}`.
 *
 * There is no fallback chain and no "missing key" placeholder, because there can be no
 * missing key: every phrase carries both languages in one object, so TypeScript rejects
 * a translation that was never written. A string that reaches the screen is a string
 * somebody wrote in that language.
 *
 * A placeholder with no matching parameter is left as written rather than blanked —
 * "Card {index} of 10" is a visible bug, an empty gap is a silent one.
 */
export function t(key: StringKey, language: UiLanguage, params?: Params): string {
  const phrase = STRINGS[key][language];
  if (!params) return phrase;

  return phrase.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  );
}

/** A translator bound to one language, for components that use many strings. */
export function translator(language: UiLanguage) {
  return (key: StringKey, params?: Params) => t(key, language, params);
}

export type Translate = ReturnType<typeof translator>;

/**
 * Picks one of a numbered set of phrases, deterministically for a given seed.
 *
 * Used for the praise on a correct answer: the same card praised the same way every
 * time reads like a stuck recording, and praise chosen at random re-rolls on every
 * React re-render.
 */
export function pickPhrase<K extends StringKey>(keys: readonly K[], seed: number): K {
  return keys[Math.abs(Math.trunc(seed)) % keys.length];
}

export const PERFECT_PRAISE = [
  "praise.perfect.1",
  "praise.perfect.2",
  "praise.perfect.3",
  "praise.perfect.4",
] as const satisfies readonly StringKey[];

export const GREAT_PRAISE = [
  "praise.great.1",
  "praise.great.2",
  "praise.great.3",
] as const satisfies readonly StringKey[];
