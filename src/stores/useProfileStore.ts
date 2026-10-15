"use client";

import { create } from "zustand";
import { closeDatabase, deleteDatabase } from "@/lib/db/client";
import {
  CLAIMS_PROBLEMS,
  forgetGoogleSession,
  hasSkippedSignIn,
  isGoogleConfigured,
  readCredential,
  setSkippedSignIn,
} from "@/lib/auth";
import {
  addProfile,
  activeProfile,
  findByGoogleSub,
  hasAnyGoogleLink,
  linkGoogle,
  newProfile,
  writeRegistry as persist,
  clearUnlocked,
  dbNameFor,
  findProfile,
  hashPasscode,
  isNameTaken,
  isUnlocked,
  markUnlocked,
  MAX_PROFILES,
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
  signInWithGoogle: (credential: string) => Promise<void>;
  continueWithoutSignIn: () => void;
  unlinkGoogle: (id: string) => void;
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

    // With sign-in configured, a device nobody has ever signed in on opens on the
    // sign-in screen. Once anyone has, the app opens straight to the dashboard until
    // they sign out — the point is a front door, not a toll gate on every load.
    if (isGoogleConfigured() && !hasAnyGoogleLink(registry) && !hasSkippedSignIn()) return "picking";

    const profile = activeProfile(registry);
    if (!profile) return "picking";
    return isUnlocked(profile) ? "open" : "locked";
  },

  /**
   * Carries on with local profiles instead.
   *
   * Always available, and remembered. Google being configured must never lock someone
   * out of data sitting on their own device, whether because Google is unreachable or
   * because they would simply rather not.
   */
  continueWithoutSignIn: () => {
    const { registry } = get();
    if (!registry) return;
    setSkippedSignIn(true);
    // Nobody is active after a sign-out, so put them back into the one profile there is.
    const next = registry.activeId ? registry : switchTo(registry, registry.profiles[0].id, Date.now());
    writeRegistry(next);
    set({ registry: next });
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
      // Same as choosing one: making a local profile answers the front door.
      setSkippedSignIn(true);
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
      // Choosing a local profile *is* an answer to the front door's question. Without
      // this the next load would ask again and bounce straight back out of the app.
      setSkippedSignIn(true);
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
    setSkippedSignIn(false);
    // So Google does not silently re-select the same account on the next load.
    forgetGoogleSession();
    restart();
  },

  /**
   * Opens the profile a Google account belongs to, creating it the first time.
   *
   * The token decides **which** local profile to open and nothing else. It is verified
   * because reading a name out of an unverified JWT is a bad habit, not because that
   * verification protects anything — there is no server here for it to protect.
   */
  signInWithGoogle: async (credential) => {
    const { registry } = get();
    if (!registry) return;
    set({ busy: true, error: null });

    const result = await readCredential(credential);
    if (!result.ok) {
      set({ busy: false, error: CLAIMS_PROBLEMS[result.problem] });
      return;
    }

    const { sub, name, picture } = result.identity;
    const now = Date.now();

    try {
      const existing = findByGoogleSub(registry, sub);
      if (existing) {
        // Keep the picture current, then open the profile this account already owns.
        const refreshed = linkGoogle(registry, existing.id, { sub, avatarUrl: picture });
        persist(switchTo(refreshed, existing.id, now));
        await closeDatabase();
        clearUnlocked();
        restart();
        return;
      }

      if (registry.profiles.length >= MAX_PROFILES) {
        throw new Error(`This device already has ${MAX_PROFILES} profiles. Remove one first.`);
      }

      // A name Google supplied may collide with a profile already here, and the clash
      // is not the learner's fault, so disambiguate rather than refuse the sign-in.
      let unique = name;
      for (let n = 2; isNameTaken(registry, unique); n++) unique = `${name} ${n}`;

      const profile = { ...newProfile(unique, now), googleSub: sub, avatarUrl: picture ?? null };
      const next = {
        ...registry,
        profiles: [...registry.profiles, profile],
        activeId: profile.id,
      };
      persist(next);
      await closeDatabase();
      clearUnlocked();
      restart();
    } catch (error) {
      set({ busy: false, error: message(error) });
    }
  },

  /** Detaches the Google account. The profile and everything in it stay exactly as they are. */
  unlinkGoogle: (id) => {
    const { registry } = get();
    if (!registry) return;
    try {
      const next = linkGoogle(registry, id, null);
      writeRegistry(next);
      forgetGoogleSession();
      set({ registry: next, error: null });
    } catch (error) {
      set({ error: message(error) });
    }
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
