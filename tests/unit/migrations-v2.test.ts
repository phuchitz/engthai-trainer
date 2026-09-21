import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { openDB } from "idb";
import { DB_NAME, DB_VERSION } from "@/lib/db/schema";
import { deleteDatabase, getDatabase } from "@/lib/db/client";
import { MIGRATIONS, migrationsToRun } from "@/lib/db/migrations";
import { getSentence, listSentencesByCategory } from "@/lib/db/repositories/sentences";
import { v1 } from "@/lib/db/migrations/v1";
import { DEFAULT_CATEGORY } from "@/lib/models";

const NOW = 1_700_000_000_000;

/** A sentence exactly as v1 wrote it: no `category` field at all. */
const legacySentence = {
  id: "legacy-1",
  en: "I am very hungry.",
  th: "ฉันหิวมาก",
  enAlternates: [],
  thAlternates: [],
  tags: ["everyday"],
  level: "A1",
  lessonIds: [],
  vocabIds: [],
  source: "builtin",
  createdAt: NOW,
  updatedAt: NOW,
};

/** Opens at v1 only, so the test can write a genuinely old row before upgrading. */
async function openAtV1() {
  return openDB(DB_NAME, 1, {
    async upgrade(db, oldVersion, newVersion, tx) {
      for (const migration of migrationsToRun([v1], oldVersion, newVersion ?? 1)) {
        await migration.migrate({ db, tx } as never);
      }
    },
  });
}

beforeEach(async () => {
  await deleteDatabase();
});

afterEach(async () => {
  await deleteDatabase();
});

describe("v2 migration", () => {
  it("is registered in the ladder", () => {
    expect(MIGRATIONS.map((m) => m.version)).toContain(2);
    // The ladder stays contiguous and ends at the current version.
    expect(MIGRATIONS.map((m) => m.version)).toEqual(Array.from({ length: DB_VERSION }, (_, i) => i + 1));
  });

  it("adds the category index to an existing v1 database", async () => {
    (await openAtV1()).close();

    const db = await getDatabase();
    expect(db.version).toBe(DB_VERSION);
    const tx = db.transaction("sentences", "readonly");
    expect(Array.from(tx.objectStore("sentences").indexNames)).toContain("by-category");
    await tx.done;
  });

  it("backfills a row written before categories existed", async () => {
    const legacy = await openAtV1();
    await legacy.put("sentences", legacySentence);
    legacy.close();

    await getDatabase();

    const migrated = await getSentence("legacy-1");
    expect(migrated?.category).toBe(DEFAULT_CATEGORY);
  });

  it("makes the backfilled row reachable through the new index", async () => {
    const legacy = await openAtV1();
    await legacy.put("sentences", legacySentence);
    legacy.close();

    await getDatabase();

    // The real point of backfilling inside the upgrade: without a value, the row would
    // be absent from the index and would silently vanish from its category listing.
    const found = await listSentencesByCategory(DEFAULT_CATEGORY);
    expect(found.map((s) => s.id)).toContain("legacy-1");
  });

  it("preserves every other field", async () => {
    const legacy = await openAtV1();
    await legacy.put("sentences", legacySentence);
    legacy.close();

    await getDatabase();

    const migrated = await getSentence("legacy-1");
    expect(migrated?.en).toBe(legacySentence.en);
    expect(migrated?.th).toBe("ฉันหิวมาก");
    expect(migrated?.tags).toEqual(["everyday"]);
    expect(migrated?.createdAt).toBe(NOW);
  });

  it("backfills several rows in one pass", async () => {
    const legacy = await openAtV1();
    for (let i = 0; i < 5; i++) {
      await legacy.put("sentences", { ...legacySentence, id: `legacy-${i}` });
    }
    legacy.close();

    await getDatabase();

    expect(await listSentencesByCategory(DEFAULT_CATEGORY)).toHaveLength(5);
  });

  it("leaves an explicit category alone", async () => {
    const legacy = await openAtV1();
    await legacy.put("sentences", { ...legacySentence, id: "already", category: "software" });
    legacy.close();

    await getDatabase();

    expect((await getSentence("already"))?.category).toBe("software");
    expect(await listSentencesByCategory("software")).toHaveLength(1);
  });

  it("runs cleanly on a fresh database with nothing to backfill", async () => {
    const db = await getDatabase();
    expect(db.version).toBe(DB_VERSION);
    expect(await listSentencesByCategory(DEFAULT_CATEGORY)).toEqual([]);
  });
});
