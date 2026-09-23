"use client";

import { create } from "zustand";
import { closeDatabase, deleteDatabase } from "@/lib/db/client";
import {
  addProfile,
  activeProfile,
  clearUnlocked,
  dbNameFor,
  findProfile,
  hashPasscode,
  isUnlocked,
  markUnlocked,
  readRegistry,
  removeProfile,
  renameProfile,
  setPasscode,
  switchTo,
  verifyPasscode,
  writeRegistry,
  type Profile,
  type ProfileRegistry,
} from "@/lib/profiles";

/** What the gate is currently showing. */
export type GateState = "pending" | "picking" | "locked" | "open";

export type ProfileState = {
  registry: ProfileRegistry | null;
  /** False until the browser has been read; the prerendered HTML cannot know any of this. */
  hydrated: boolean;
  busy: boolean;
  error: string | null;
  /** Failed passcode entries in this tab, used only to slow repeated guessing. */
  failures: number;

  hydrate: () => void;
  gate: () => GateState;
  current: () => Profile | null;

  create: (name: string) => Promise<void>;
  select: (id: string) => Promise<void>;
  unlock: (digits: string) => Promise<boolean>;
  signOut: () => void;
  rename: (id: string, name: string) => void;
  changePasscode: (id: string, digits: string | null) => Promise<void>;
  forgetPasscode: (id: string) => void;
  remove: (id: string) => Promise<void>;
  clearError: () => void;
};

/**
 * Switching who is studying reloads the page.
 *
 * Every other store in the app holds rows from the profile being left — a half-finished
 * queue, a loaded dashboard, cached vocabulary. Clearing them one by one is a list that
 * would go stale the next time a store is added; a reload cannot miss one.
 */
function restart() {
  // A full document load, not a router push: the point is to discard the running app.
  window.location.assign(new URL("/", window.location.origin).toString());
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

export const useProfileStore = create<ProfileState>((set, get) => ({
  registry: null,
  hydrated: false,
  busy: false,
  error: null,
  failures: 0,

  hydrate: () => {
    if (get().hydrated) return;
    set({ registry: readRegistry(), hydrated: true });
  },

  gate: () => {
    const { registry, hydrated } = get();
    if (!hydrated || !registry) return "pending";
    const profile = activeProfile(registry);
    if (!profile) return "picking";
    return isUnlocked(profile) ? "open" : "locked";
  },

  current: () => {
    const { registry } = get();
    return registry ? activeProfile(registry) : null;
  },

  create: async (name) => {
    const { registry } = get();
    if (!registry) return;
    set({ busy: true, error: null });
    try {
      const next = addProfile(registry, name, Date.now());
      writeRegistry(next);
      await closeDatabase();
      clearUnlocked();
      restart();
    } catch (error) {
      set({ busy: false, error: message(error) });
    }
  },

  select: async (id) => {
    const { registry } = get();
    if (!registry) return;
    set({ busy: true, error: null });
    try {
      const next = switchTo(registry, id, Date.now());
      writeRegistry(next);
      await closeDatabase();
      // A passcode on the profile being entered must be met again, in every tab.
      clearUnlocked();
      restart();
    } catch (error) {
      set({ busy: false, error: message(error) });
    }
  },

  unlock: async (digits) => {
    const profile = get().current();
    if (!profile?.passcode) return false;

    set({ busy: true, error: null });
    // A deliberate pause after repeated misses. It does not make a four-digit code hard
    // to guess — nothing here could — it just makes idle poking tedious.
    if (get().failures >= 3) await new Promise((r) => setTimeout(r, 1000));

    const ok = await verifyPasscode(digits, profile.passcode);
    if (ok) {
      markUnlocked(profile.id);
      set({ busy: false, failures: 0, registry: readRegistry() });
      return true;
    }

    set((s) => ({ busy: false, failures: s.failures + 1, error: "That is not the passcode." }));
    return false;
  },

  signOut: () => {
    const { registry } = get();
    if (!registry) return;
    writeRegistry(switchTo(registry, null, Date.now()));
    clearUnlocked();
    restart();
  },

  rename: (id, name) => {
    const { registry } = get();
    if (!registry) return;
    try {
      const next = renameProfile(registry, id, name, Date.now());
      writeRegistry(next);
      set({ registry: next, error: null });
    } catch (error) {
      set({ error: message(error) });
    }
  },

  changePasscode: async (id, digits) => {
    const { registry } = get();
    if (!registry) return;
    set({ busy: true, error: null });
    try {
      const passcode = digits === null ? null : await hashPasscode(digits);
      const next = setPasscode(registry, id, passcode);
      writeRegistry(next);
      if (passcode) markUnlocked(id);
      set({ registry: next, busy: false });
    } catch (error) {
      set({ busy: false, error: message(error) });
    }
  },

  /**
   * Drops a forgotten passcode.
   *
   * Nothing is encrypted, so a passcode that cannot be recalled would lock someone out
   * of their own progress for no gain — the data would still be sitting there, readable
   * by anyone who opened the developer tools. The screen that offers this makes the
   * learner type the profile name first, which is the same speed bump "delete
   * everything" uses.
   */
  forgetPasscode: (id) => {
    const { registry } = get();
    if (!registry) return;
    const next = setPasscode(registry, id, null);
    writeRegistry(next);
    markUnlocked(id);
    set({ registry: next, error: null, failures: 0 });
  },

  remove: async (id) => {
    const { registry } = get();
    if (!registry) return;
    set({ busy: true, error: null });
    try {
      // The database goes first. Forgetting the profile before its data was actually
      // dropped would leave rows on the device that nothing can reach or delete.
      await deleteDatabase(5000, dbNameFor(id));
      const next = removeProfile(registry, id);
      writeRegistry(next);

      if (registry.activeId === id) {
        clearUnlocked();
        restart();
        return;
      }
      set({ registry: next, busy: false });
    } catch (error) {
      set({ busy: false, error: message(error) });
    }
  },

  clearError: () => set({ error: null }),
}));

export { findProfile };
