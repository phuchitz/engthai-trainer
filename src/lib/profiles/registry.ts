import { z } from "zod";
import { DB_NAME } from "@/lib/db/schema";
import { passcodeSchema, type Passcode } from "./passcode";

/**
 * Who is studying on this device.
 *
 * Profiles are **local only**. There is no account, no server and nothing to sign in to:
 * this keeps two people who share a laptop from sharing a schedule, and that is all it
 * claims to do. Each profile gets its own IndexedDB database, so nothing is merged,
 * filtered or joined at read time — the separation is the database boundary itself.
 *
 * The registry lives in `localStorage` rather than IndexedDB because the active profile
 * has to be known *before* any database is opened, and because it must survive the
 * deletion of any one profile's data.
 */
export const profileSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(40),
  createdAt: z.number().int().nonnegative(),
  lastActiveAt: z.number().int().nonnegative(),
  /** Null when the profile opens straight into the app. */
  passcode: passcodeSchema.nullable().default(null),
});

export type Profile = z.infer<typeof profileSchema>;

export const registrySchema = z.object({
  version: z.literal(1),
  profiles: z.array(profileSchema),
  /** Null after signing out, which is what brings the picker back. */
  activeId: z.string().nullable(),
});

export type ProfileRegistry = z.infer<typeof registrySchema>;

export const REGISTRY_STORAGE_KEY = "engthai.profiles";
export const UNLOCKED_SESSION_KEY = "engthai.unlocked";

/**
 * The profile that owns the original database.
 *
 * Everything written before profiles existed lives in `engthai-trainer`, and IndexedDB
 * cannot rename a database. So the first profile keeps that name and every later one is
 * suffixed. A learner who never opens the profile screen is not migrated, not copied and
 * not at risk.
 */
export const LEGACY_PROFILE_ID = "default";

export const MAX_PROFILES = 8;

export function dbNameFor(profileId: string): string {
  return profileId === LEGACY_PROFILE_ID ? DB_NAME : `${DB_NAME}--${profileId}`;
}

export function newProfile(name: string, now: number, id?: string): Profile {
  return profileSchema.parse({
    id: id ?? `p${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    name,
    createdAt: now,
    lastActiveAt: now,
    passcode: null,
  });
}

/** The registry a device gets on its very first read, owning the existing database. */
export function initialRegistry(now: number, name = "Me"): ProfileRegistry {
  return {
    version: 1,
    profiles: [newProfile(name, now, LEGACY_PROFILE_ID)],
    activeId: LEGACY_PROFILE_ID,
  };
}

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    // Blocked site data. The app still runs; it just cannot remember who is studying.
    return null;
  }
}

/**
 * Reads the registry, creating the single-profile default when there is none.
 *
 * A corrupt or hand-edited value is replaced rather than thrown on: failing to parse
 * must not lock someone out of an app whose whole point is that it works offline.
 */
export function readRegistry(now: number = Date.now()): ProfileRegistry {
  const store = storage();
  if (!store) return initialRegistry(now);

  const raw = store.getItem(REGISTRY_STORAGE_KEY);
  if (raw === null) {
    const created = initialRegistry(now);
    writeRegistry(created);
    return created;
  }

  const parsed = registrySchema.safeParse(safeJson(raw));
  if (!parsed.success || parsed.data.profiles.length === 0) return initialRegistry(now);

  // An activeId pointing at a profile that no longer exists means the picker, not a crash.
  const known = new Set(parsed.data.profiles.map((p) => p.id));
  const activeId = parsed.data.activeId && known.has(parsed.data.activeId) ? parsed.data.activeId : null;
  return { ...parsed.data, activeId };
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeRegistry(registry: ProfileRegistry): void {
  storage()?.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(registrySchema.parse(registry)));
}

export function findProfile(registry: ProfileRegistry, id: string | null): Profile | null {
  if (id === null) return null;
  return registry.profiles.find((p) => p.id === id) ?? null;
}

export function activeProfile(registry: ProfileRegistry): Profile | null {
  return findProfile(registry, registry.activeId);
}

/** The database the active profile reads and writes. Falls back to the original name. */
export function activeDbName(registry: ProfileRegistry = readRegistry()): string {
  return dbNameFor(registry.activeId ?? LEGACY_PROFILE_ID);
}

export function isNameTaken(registry: ProfileRegistry, name: string, exceptId?: string): boolean {
  const key = name.trim().toLocaleLowerCase();
  return registry.profiles.some((p) => p.id !== exceptId && p.name.toLocaleLowerCase() === key);
}

// ------------------------------------------------------------------ registry updates

export function addProfile(registry: ProfileRegistry, name: string, now: number): ProfileRegistry {
  if (registry.profiles.length >= MAX_PROFILES) {
    throw new Error(`This device already has ${MAX_PROFILES} profiles.`);
  }
  if (isNameTaken(registry, name)) throw new Error(`There is already a profile called "${name.trim()}".`);

  const profile = newProfile(name, now);
  return { ...registry, profiles: [...registry.profiles, profile], activeId: profile.id };
}

export function renameProfile(
  registry: ProfileRegistry,
  id: string,
  name: string,
  now: number,
): ProfileRegistry {
  if (isNameTaken(registry, name, id)) throw new Error(`There is already a profile called "${name.trim()}".`);
  return {
    ...registry,
    profiles: registry.profiles.map((p) =>
      p.id === id ? profileSchema.parse({ ...p, name, lastActiveAt: now }) : p,
    ),
  };
}

/**
 * Forgets a profile.
 *
 * The registry entry goes; **its database does not**. Dropping an IndexedDB database is
 * a separate, fallible operation that has to be reported honestly, so the caller does it
 * and only records the removal once it has actually happened.
 */
export function removeProfile(registry: ProfileRegistry, id: string): ProfileRegistry {
  const profiles = registry.profiles.filter((p) => p.id !== id);
  if (profiles.length === 0) throw new Error("A device keeps at least one profile.");
  return { ...registry, profiles, activeId: registry.activeId === id ? null : registry.activeId };
}

export function setPasscode(
  registry: ProfileRegistry,
  id: string,
  passcode: Passcode | null,
): ProfileRegistry {
  return {
    ...registry,
    profiles: registry.profiles.map((p) => (p.id === id ? { ...p, passcode } : p)),
  };
}

export function switchTo(registry: ProfileRegistry, id: string | null, now: number): ProfileRegistry {
  if (id === null) return { ...registry, activeId: null };
  if (!registry.profiles.some((p) => p.id === id)) throw new Error("No such profile.");
  return {
    ...registry,
    activeId: id,
    profiles: registry.profiles.map((p) => (p.id === id ? { ...p, lastActiveAt: now } : p)),
  };
}

// ------------------------------------------------------------------- unlocked state

/**
 * Whether this tab has already met the passcode.
 *
 * Kept in `sessionStorage`, so closing the tab re-locks. A profile with no passcode is
 * always unlocked — there is nothing to meet.
 */
export function isUnlocked(profile: Profile | null): boolean {
  if (!profile) return false;
  if (!profile.passcode) return true;
  try {
    return sessionStorage.getItem(UNLOCKED_SESSION_KEY) === profile.id;
  } catch {
    return false;
  }
}

export function markUnlocked(profileId: string): void {
  try {
    sessionStorage.setItem(UNLOCKED_SESSION_KEY, profileId);
  } catch {
    // Without session storage the learner re-enters the passcode on each navigation.
  }
}

export function clearUnlocked(): void {
  try {
    sessionStorage.removeItem(UNLOCKED_SESSION_KEY);
  } catch {
    // Nothing to clear.
  }
}
