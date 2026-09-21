import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { deleteDatabase, getDatabase } from "@/lib/db/client";
import { DB_VERSION } from "@/lib/db/schema";
import { MIGRATIONS } from "@/lib/db/migrations";
import { loadSettings } from "@/lib/db/repositories/settings";
import { inspectBackup, serializeBackup, createBackup } from "@/lib/importexport";

const NOW = 1_700_000_000_000;

/** A settings row exactly as an earlier version wrote it, credential and all. */
const legacySettings = {
  id: "singleton",
  dailyGoal: 20,
  newPerDay: 10,
  maxReviewsPerDay: 120,
  strictness: "normal",
  ignoreCase: true,
  ignorePunctuation: true,
  ttsEnabled: true,
  ttsVoiceEn: null,
  ttsVoiceTh: null,
  ttsRate: 1,
  sttEnabled: false,
  uiLanguage: "en",
  ai: { enabled: true, provider: "openai", apiKey: "sk-should-not-survive", model: "gpt-x" },
  streak: { current: 0, longest: 0, lastStudyDate: null, freezesRemaining: 0 },
  createdAt: NOW,
  updatedAt: NOW,
};

beforeEach(async () => {
  await deleteDatabase();
});

afterEach(async () => {
  await deleteDatabase();
});

describe("v5 migration", () => {
  it("is the current version and keeps the ladder contiguous", () => {
    expect(MIGRATIONS.map((m) => m.version)).toEqual(Array.from({ length: DB_VERSION }, (_, i) => i + 1));
    expect(MIGRATIONS.map((m) => m.version)).toContain(5);
  });

  it("strips a stored credential from the settings row", async () => {
    const db = await getDatabase();
    // Written straight to the store, bypassing the schema, as an old build would have.
    await db.put("settings", legacySettings as never);

    const raw = await db.get("settings", "singleton");
    expect(raw?.ai).toHaveProperty("apiKey");

    // Reopening replays the ladder from the stored version, so force it by hand: the
    // point under test is the migration body, run against a row that has the key.
    await MIGRATIONS[4].migrate({
      db,
      tx: { objectStore: () => db.transaction("settings", "readwrite").objectStore("settings") },
    } as never);

    const cleaned = await db.get("settings", "singleton");
    expect(cleaned?.ai).not.toHaveProperty("apiKey");
    expect(JSON.stringify(cleaned)).not.toContain("sk-should-not-survive");
  });

  it("leaves the rest of the AI settings alone", async () => {
    const db = await getDatabase();
    await db.put("settings", legacySettings as never);

    await MIGRATIONS[4].migrate({
      db,
      tx: { objectStore: () => db.transaction("settings", "readwrite").objectStore("settings") },
    } as never);

    const settings = await loadSettings(NOW);
    expect(settings.ai.enabled).toBe(true);
    expect(settings.ai.provider).toBe("openai");
    expect(settings.ai.model).toBe("gpt-x");
  });

  it("does nothing on a row that never had a key", async () => {
    const before = await loadSettings(NOW);
    const db = await getDatabase();

    await MIGRATIONS[4].migrate({
      db,
      tx: { objectStore: () => db.transaction("settings", "readwrite").objectStore("settings") },
    } as never);

    expect(await loadSettings(NOW)).toEqual(before);
  });
});

describe("a credential cannot re-enter through a backup", () => {
  it("is dropped when an old backup file is validated", async () => {
    await loadSettings(NOW);
    const backup = JSON.parse(serializeBackup(await createBackup(NOW)));

    // Hand-edit the file the way an old export would have looked.
    backup.data.settings[0].ai.apiKey = "sk-from-an-old-backup";

    const inspection = inspectBackup(JSON.stringify(backup));
    expect(inspection.ok).toBe(true);
    if (!inspection.ok) return;

    // Zod strips what the schema does not declare, so the key never reaches the store.
    expect(inspection.backup.data.settings[0].ai).not.toHaveProperty("apiKey");
    expect(JSON.stringify(inspection.backup)).not.toContain("sk-from-an-old-backup");
  });
});
