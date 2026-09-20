"use client";

import { useCallback, useSyncExternalStore } from "react";

export type ThemePreference = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "engthai.theme";

/**
 * Runs before first paint to stop a light flash on a dark-themed reload.
 * Kept in sync with this module by hand — both read THEME_STORAGE_KEY.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}})()`;

const listeners = new Set<() => void>();
let cached: ThemePreference | null = null;

function readStored(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    if (value === "light" || value === "dark" || value === "system") return value;
  } catch {
    // Private mode or blocked site data: follow the operating system instead.
  }
  return "system";
}

function getSnapshot(): ThemePreference {
  cached ??= readStored();
  return cached;
}

/** Prerendered HTML cannot know the stored preference, so it always renders "system". */
function getServerSnapshot(): ThemePreference {
  return "system";
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY) return;
    cached = null;
    applyToDocument(getSnapshot());
    listeners.forEach((l) => l());
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function applyToDocument(preference: ThemePreference) {
  const root = document.documentElement;
  if (preference === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", preference);
}

export function setThemePreference(next: ThemePreference) {
  cached = next;
  applyToDocument(next);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // The preference will not persist, but the current session still honours it.
  }
  listeners.forEach((l) => l());
}

export function useTheme() {
  const preference = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setPreference = useCallback((next: ThemePreference) => setThemePreference(next), []);
  return { preference, setPreference };
}
