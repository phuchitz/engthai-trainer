"use client";

import { useCallback, useSyncExternalStore } from "react";
import { DEFAULT_LANGUAGE, isUiLanguage, translator, type UiLanguage } from "@/lib/i18n";

/**
 * Interface language and text size.
 *
 * Both live in `localStorage` rather than the settings store, for the reason the theme
 * does: they have to be readable **synchronously before first paint**. Reading them from
 * IndexedDB would render the whole app in English at the default size and then swap it,
 * on every single load.
 *
 * They are therefore per-browser, not per-profile, and a restored backup does not carry
 * them — the same trade the theme already makes.
 */
export const LANGUAGE_STORAGE_KEY = "engthai.language";
export const TEXT_SIZE_STORAGE_KEY = "engthai.textSize";

export const TEXT_SIZES = ["s", "m", "l", "xl"] as const;
export type TextSize = (typeof TEXT_SIZES)[number];
export const DEFAULT_TEXT_SIZE: TextSize = "m";

function isTextSize(value: unknown): value is TextSize {
  return typeof value === "string" && (TEXT_SIZES as readonly string[]).includes(value);
}

/**
 * Runs before first paint. Sets `lang` so the right font and line height apply to the
 * first frame, and `data-text` so nothing is laid out twice.
 *
 * Kept in sync with this module by hand — both read the same two keys.
 */
export const DISPLAY_INIT_SCRIPT = `(function(){try{
var l=localStorage.getItem(${JSON.stringify(LANGUAGE_STORAGE_KEY)});
if(l==="th"||l==="en")document.documentElement.setAttribute("lang",l);
var s=localStorage.getItem(${JSON.stringify(TEXT_SIZE_STORAGE_KEY)});
if(s==="s"||s==="m"||s==="l"||s==="xl")document.documentElement.setAttribute("data-text",s);
}catch(e){}})()`
  .split("\n")
  .join("");

type Listener = () => void;
const listeners = new Set<Listener>();

let cachedLanguage: UiLanguage | null = null;
let cachedTextSize: TextSize | null = null;

function read<T>(key: string, guard: (v: unknown) => v is T, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return guard(value) ? value : fallback;
  } catch {
    // Blocked site data: the session still works, it just will not be remembered.
    return fallback;
  }
}

function languageSnapshot(): UiLanguage {
  cachedLanguage ??= read(LANGUAGE_STORAGE_KEY, isUiLanguage, DEFAULT_LANGUAGE);
  return cachedLanguage;
}

function textSizeSnapshot(): TextSize {
  cachedTextSize ??= read(TEXT_SIZE_STORAGE_KEY, isTextSize, DEFAULT_TEXT_SIZE);
  return cachedTextSize;
}

/** Prerendered HTML cannot know either preference, so it renders the defaults. */
const serverLanguage = () => DEFAULT_LANGUAGE;
const serverTextSize = () => DEFAULT_TEXT_SIZE;

function subscribe(onChange: Listener) {
  listeners.add(onChange);
  const onStorage = (event: StorageEvent) => {
    // Another tab changed it; drop the cache and re-apply so both tabs agree.
    if (event.key === LANGUAGE_STORAGE_KEY) {
      cachedLanguage = null;
      applyLanguage(languageSnapshot());
    } else if (event.key === TEXT_SIZE_STORAGE_KEY) {
      cachedTextSize = null;
      applyTextSize(textSizeSnapshot());
    } else return;
    listeners.forEach((l) => l());
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function applyLanguage(language: UiLanguage) {
  // `lang` drives the font stack and the Thai line height, not just assistive tech.
  document.documentElement.setAttribute("lang", language);
}

function applyTextSize(size: TextSize) {
  document.documentElement.setAttribute("data-text", size);
}

export function setUiLanguage(next: UiLanguage) {
  cachedLanguage = next;
  applyLanguage(next);
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
  } catch {
    // Not persisted, but honoured for this session.
  }
  listeners.forEach((l) => l());
}

export function setTextSize(next: TextSize) {
  cachedTextSize = next;
  applyTextSize(next);
  try {
    localStorage.setItem(TEXT_SIZE_STORAGE_KEY, next);
  } catch {
    // As above.
  }
  listeners.forEach((l) => l());
}

export function useUiLanguage() {
  const language = useSyncExternalStore(subscribe, languageSnapshot, serverLanguage);
  const setLanguage = useCallback((next: UiLanguage) => setUiLanguage(next), []);
  return { language, setLanguage };
}

export function useTextSize() {
  const size = useSyncExternalStore(subscribe, textSizeSnapshot, serverTextSize);
  const setSize = useCallback((next: TextSize) => setTextSize(next), []);
  return { size, setSize };
}

/** The translator for the current language. The hook every component reaches for. */
export function useT() {
  const language = useSyncExternalStore(subscribe, languageSnapshot, serverLanguage);
  return { t: translator(language), language };
}
