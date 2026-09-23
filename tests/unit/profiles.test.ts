import { describe, it, expect, beforeEach } from "vitest";
import {
  addProfile,
  activeDbName,
  activeProfile,
  clearUnlocked,
  dbNameFor,
  hashPasscode,
  initialRegistry,
  isNameTaken,
  isPasscodeSupported,
  isUnlocked,
  isValidPasscode,
  markUnlocked,
  MAX_PROFILES,
  newProfile,
  readRegistry,
  removeProfile,
  renameProfile,
  setPasscode,
  switchTo,
  verifyPasscode,
  writeRegistry,
  LEGACY_PROFILE_ID,
  REGISTRY_STORAGE_KEY,
  type ProfileRegistry,
} from "@/lib/profiles";
import { DB_NAME } from "@/lib/db/schema";

const NOW = 1_700_000_000_000;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("the first read on a device", () => {
  it("creates one profile owning the database that already exists", () => {
    // Everything written before profiles existed lives in `engthai-trainer`, and
    // IndexedDB cannot rename a database. Nothing is copied or migrated.
    const registry = readRegistry(NOW);

    expect(registry.profiles).toHaveLength(1);
    expect(registry.profiles[0].id).toBe(LEGACY_PROFILE_ID);
    expect(registry.activeId).toBe(LEGACY_PROFILE_ID);
    expect(activeDbName(registry)).toBe(DB_NAME);
  });

  it("starts with no passcode, so a single learner notices nothing", () => {
    expect(readRegistry(NOW).profiles[0].passcode).toBeNull();
    expect(isUnlocked(readRegistry(NOW).profiles[0])).toBe(true);
  });

  it("persists what it created, rather than inventing a new id each read", () => {
    const first = readRegistry(NOW);
    const second = readRegistry(NOW + 5000);
    expect(second.profiles[0].id).toBe(first.profiles[0].id);
  });
});

describe("recovering from a broken registry", () => {
  it.each([
    ["not json at all", "{{{"],
    ["the wrong shape", JSON.stringify({ version: 1, profiles: "nope", activeId: null })],
    ["an empty profile list", JSON.stringify({ version: 1, profiles: [], activeId: null })],
    ["a future version", JSON.stringify({ version: 99, profiles: [], activeId: "x" })],
  ])("falls back to a working default when the stored value is %s", (_label, raw) => {
    // Failing to parse must not lock anyone out of an app whose point is working offline.
    localStorage.setItem(REGISTRY_STORAGE_KEY, raw);
    const registry = readRegistry(NOW);
    expect(registry.profiles).toHaveLength(1);
    expect(registry.activeId).toBe(LEGACY_PROFILE_ID);
  });

  it("shows the picker when the active profile has gone missing", () => {
    writeRegistry({
      version: 1,
      profiles: [newProfile("Ben", NOW, LEGACY_PROFILE_ID)],
      activeId: "someone-deleted",
    });
    expect(readRegistry(NOW).activeId).toBeNull();
  });
});

describe("each profile owns its own database", () => {
  it("keeps the original name for the first profile and suffixes the rest", () => {
    expect(dbNameFor(LEGACY_PROFILE_ID)).toBe(DB_NAME);
    expect(dbNameFor("p2")).toBe(`${DB_NAME}--p2`);
  });

  it("gives every profile a distinct database", () => {
    let registry = readRegistry(NOW);
    registry = addProfile(registry, "Nok", NOW);
    registry = addProfile(registry, "Ploy", NOW + 1);

    const names = registry.profiles.map((p) => dbNameFor(p.id));
    expect(new Set(names).size).toBe(3);
  });

  it("follows the active profile", () => {
    let registry = addProfile(readRegistry(NOW), "Nok", NOW);
    expect(activeDbName(registry)).toBe(dbNameFor(registry.activeId!));

    registry = switchTo(registry, LEGACY_PROFILE_ID, NOW);
    expect(activeDbName(registry)).toBe(DB_NAME);
  });

  it("falls back to the original database when nobody is signed in", () => {
    const registry = switchTo(readRegistry(NOW), null, NOW);
    expect(activeDbName(registry)).toBe(DB_NAME);
  });
});

describe("adding and removing profiles", () => {
  let registry: ProfileRegistry;

  beforeEach(() => {
    registry = readRegistry(NOW);
  });

  it("makes a new profile the active one", () => {
    const next = addProfile(registry, "Nok", NOW);
    expect(next.profiles).toHaveLength(2);
    expect(activeProfile(next)?.name).toBe("Nok");
  });

  it("refuses a name already in use, ignoring case", () => {
    const next = addProfile(registry, "Nok", NOW);
    expect(() => addProfile(next, "nok", NOW)).toThrow(/already a profile/);
    expect(isNameTaken(next, "  NOK  ".trim())).toBe(true);
  });

  it("stops at the device limit", () => {
    let next = registry;
    for (let i = 1; i < MAX_PROFILES; i++) next = addProfile(next, `Person ${i}`, NOW + i);
    expect(next.profiles).toHaveLength(MAX_PROFILES);
    expect(() => addProfile(next, "One too many", NOW)).toThrow(/already has/);
  });

  it("renames without disturbing anything else", () => {
    const next = renameProfile(registry, LEGACY_PROFILE_ID, "Ben", NOW + 10);
    expect(next.profiles[0].name).toBe("Ben");
    expect(next.profiles[0].createdAt).toBe(registry.profiles[0].createdAt);
  });

  it("refuses to rename onto another profile's name", () => {
    const next = addProfile(registry, "Nok", NOW);
    expect(() => renameProfile(next, LEGACY_PROFILE_ID, "Nok", NOW)).toThrow(/already a profile/);
  });

  it("sends the picker back up when the profile being used is removed", () => {
    const next = removeProfile(addProfile(registry, "Nok", NOW), LEGACY_PROFILE_ID);
    expect(next.profiles).toHaveLength(1);
    expect(next.activeId).not.toBe(LEGACY_PROFILE_ID);
  });

  it("keeps the active profile when a different one is removed", () => {
    const two = addProfile(registry, "Nok", NOW);
    const next = removeProfile(two, LEGACY_PROFILE_ID);
    expect(next.activeId).toBe(two.activeId);
  });

  it("never removes the last profile", () => {
    expect(() => removeProfile(registry, LEGACY_PROFILE_ID)).toThrow(/at least one/);
  });
});

describe("the passcode", () => {
  it("is only supported where the browser can hash", () => {
    // jsdom exposes WebCrypto, so this should hold in the suite as well as in a browser.
    expect(isPasscodeSupported()).toBe(true);
  });

  it.each([
    ["1234", true],
    ["123", false],
    ["1234567890123", false],
    ["12a4", false],
    ["", false],
    ["  1234  ", false],
  ])("accepts %s as a passcode: %s", (value, valid) => {
    expect(isValidPasscode(value)).toBe(valid);
  });

  it("never stores the digits themselves", async () => {
    const passcode = await hashPasscode("2468");
    expect(JSON.stringify(passcode)).not.toContain("2468");
    expect(passcode.algorithm).toBe("PBKDF2-SHA256");
  });

  it("salts per profile, so the same digits do not hash alike", async () => {
    const [a, b] = [await hashPasscode("1234"), await hashPasscode("1234")];
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });

  it("verifies the right digits and rejects the wrong ones", async () => {
    const passcode = await hashPasscode("1234");
    expect(await verifyPasscode("1234", passcode)).toBe(true);
    expect(await verifyPasscode("4321", passcode)).toBe(false);
    expect(await verifyPasscode("", passcode)).toBe(false);
  });

  it("refuses to hash something that is not a passcode", async () => {
    await expect(hashPasscode("12")).rejects.toThrow(/digits/);
    await expect(hashPasscode("abcd")).rejects.toThrow(/digits/);
  });
});

describe("the unlocked state", () => {
  it("treats a profile with no passcode as always open", () => {
    expect(isUnlocked(newProfile("Ben", NOW))).toBe(true);
  });

  it("locks a profile that has one until it is met", async () => {
    const profile = { ...newProfile("Ben", NOW), passcode: await hashPasscode("1234") };
    expect(isUnlocked(profile)).toBe(false);

    markUnlocked(profile.id);
    expect(isUnlocked(profile)).toBe(true);
  });

  it("does not unlock a different profile", async () => {
    const ben = { ...newProfile("Ben", NOW, "a"), passcode: await hashPasscode("1234") };
    const nok = { ...newProfile("Nok", NOW, "b"), passcode: await hashPasscode("5678") };

    markUnlocked(ben.id);
    expect(isUnlocked(ben)).toBe(true);
    expect(isUnlocked(nok)).toBe(false);
  });

  it("re-locks when cleared", async () => {
    const profile = { ...newProfile("Ben", NOW), passcode: await hashPasscode("1234") };
    markUnlocked(profile.id);
    clearUnlocked();
    expect(isUnlocked(profile)).toBe(false);
  });

  it("lives in session storage, so closing the tab re-locks", async () => {
    const profile = { ...newProfile("Ben", NOW), passcode: await hashPasscode("1234") };
    markUnlocked(profile.id);
    // What the browser does on close.
    sessionStorage.clear();
    expect(isUnlocked(profile)).toBe(false);
  });
});

describe("setting and clearing a passcode", () => {
  it("attaches one to a single profile", async () => {
    const registry = addProfile(readRegistry(NOW), "Nok", NOW);
    const passcode = await hashPasscode("1234");
    const next = setPasscode(registry, LEGACY_PROFILE_ID, passcode);

    expect(next.profiles.find((p) => p.id === LEGACY_PROFILE_ID)?.passcode).toEqual(passcode);
    expect(next.profiles.find((p) => p.id !== LEGACY_PROFILE_ID)?.passcode).toBeNull();
  });

  it("clears one without touching the profile otherwise", async () => {
    const withCode = setPasscode(readRegistry(NOW), LEGACY_PROFILE_ID, await hashPasscode("1234"));
    const cleared = setPasscode(withCode, LEGACY_PROFILE_ID, null);

    expect(cleared.profiles[0].passcode).toBeNull();
    expect(cleared.profiles[0].name).toBe(withCode.profiles[0].name);
  });

  it("survives a write and read round trip", async () => {
    const registry = setPasscode(readRegistry(NOW), LEGACY_PROFILE_ID, await hashPasscode("1234"));
    writeRegistry(registry);

    const stored = readRegistry(NOW);
    expect(stored.profiles[0].passcode).not.toBeNull();
    expect(await verifyPasscode("1234", stored.profiles[0].passcode!)).toBe(true);
  });
});

describe("what the registry is allowed to contain", () => {
  it("keeps no learning data, only who exists", () => {
    // Progress belongs in each profile's own database; duplicating any of it here would
    // give two places to disagree.
    writeRegistry(initialRegistry(NOW, "Ben"));
    const raw = JSON.parse(localStorage.getItem(REGISTRY_STORAGE_KEY)!) as ProfileRegistry;

    expect(Object.keys(raw.profiles[0]).sort()).toEqual([
      "createdAt",
      "id",
      "lastActiveAt",
      "name",
      "passcode",
    ]);
  });
});
