import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { openDB, type IDBPDatabase } from "idb";
import { MIGRATIONS, migrationsToRun, type Migration } from "@/lib/db/migrations";
import { DB_NAME, DB_VERSION, STORE_NAMES } from "@/lib/db/schema";
import { deleteDatabase, getDatabase } from "@/lib/db/client";
import { putSentence, getSentence, countSentences } from "@/lib/db/repositories/sentences";

const NOW = 1_700_000_000_000;

const stub = (version: number): Migration => ({
  version,
  description: `v${version}`,
  migrate: () => {},
});

beforeEach(async () => {
  await deleteDatabase();
});

afterEach(async () => {
  await deleteDatabase();
});

describe("migrationsToRun", () => {
  const ladder = [stub(1), stub(2), stub(3), stub(4)];

  it("replays the whole ladder for a fresh database", () => {
    expect(migrationsToRun(ladder, 0, 4).map((m) => m.version)).toEqual([1, 2, 3, 4]);
  });

  it("replays every intervening step for a database several versions behind", () => {
    expect(migrationsToRun(ladder, 1, 4).map((m) => m.version)).toEqual([2, 3, 4]);
  });

  it("runs nothing when already current", () => {
    expect(migrationsToRun(ladder, 4, 4)).toEqual([]);
  });

  it("never runs past the requested version", () => {
    expect(migrationsToRun(ladder, 0, 2).map((m) => m.version)).toEqual([1, 2]);
  });

  it("applies steps in ascending order regardless of registration order", () => {
    const scrambled = [stub(3), stub(1), stub(4), stub(2)];
    expect(migrationsToRun(scrambled, 0, 4).map((m) => m.version)).toEqual([1, 2, 3, 4]);
  });
});

describe("migration registry", () => {
  it("has a contiguous ladder ending at DB_VERSION", () => {
    const versions = MIGRATIONS.map((m) => m.version);
    expect(versions).toEqual(Array.from({ length: versions.length }, (_, i) => i + 1));
    expect(versions.at(-1)).toBe(DB_VERSION);
  });

  it("has no duplicate versions", () => {
    const versions = MIGRATIONS.map((m) => m.version);
    expect(new Set(versions).size).toBe(versions.length);
  });
});

describe("upgrading a real database", () => {
  it("brings a v0 database up to the current version", async () => {
    const db = await getDatabase();
    expect(db.version).toBe(DB_VERSION);
    for (const name of STORE_NAMES) expect(Array.from(db.objectStoreNames)).toContain(name);
  });

  it("preserves existing rows across a reopen", async () => {
    await putSentence({
      id: "s1",
      en: "I will call you tomorrow.",
      th: "พรุ่งนี้ฉันจะโทรหาคุณ",
      enAlternates: [],
      thAlternates: [],
      tags: [],
      category: "daily",
      level: "A2",
      lessonIds: [],
      vocabIds: [],
      source: "builtin",
      createdAt: NOW,
      updatedAt: NOW,
    });

    const { closeDatabase } = await import("@/lib/db/client");
    await closeDatabase();

    expect(await countSentences()).toBe(1);
    expect((await getSentence("s1"))?.th).toBe("พรุ่งนี้ฉันจะโทรหาคุณ");
  });

  it("runs each pending step exactly once when stepping up a version", async () => {
    const ran: number[] = [];
    type Ctx = { db: IDBPDatabase };
    const ladder = [
      {
        version: 1,
        description: "create",
        migrate: ({ db }: Ctx) => {
          ran.push(1);
          db.createObjectStore("one", { keyPath: "id" });
        },
      },
      {
        version: 2,
        description: "add",
        migrate: ({ db }: Ctx) => {
          ran.push(2);
          db.createObjectStore("two", { keyPath: "id" });
        },
      },
    ];

    const name = `${DB_NAME}-ladder-test`;
    const open = (version: number) =>
      openDB(name, version, {
        async upgrade(db, oldVersion, newVersion) {
          for (const m of migrationsToRun(ladder, oldVersion, newVersion ?? version)) {
            await m.migrate({ db } as never);
          }
        },
      });

    (await open(1)).close();
    expect(ran).toEqual([1]);

    const v2 = await open(2);
    expect(ran).toEqual([1, 2]);
    expect(Array.from(v2.objectStoreNames).sort()).toEqual(["one", "two"]);
    v2.close();

    (await open(2)).close();
    expect(ran).toEqual([1, 2]);

    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase(name);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  });
});
