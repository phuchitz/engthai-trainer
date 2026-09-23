import { openDB, type IDBPDatabase } from "idb";
import { DB_VERSION, type EngThaiDB } from "./schema";
import { MIGRATIONS, migrationsToRun } from "./migrations";
import { activeDbName } from "@/lib/profiles/registry";

let dbPromise: Promise<IDBPDatabase<EngThaiDB>> | null = null;
/** Which profile's database `dbPromise` belongs to, so a switch cannot serve the old one. */
let openName: string | null = null;

export class DatabaseUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseUnavailableError";
  }
}

export function isDatabaseAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

/**
 * Opens the database, replaying any outstanding migrations.
 *
 * Browser-only: the app is statically exported, so every page is prerendered on the
 * server where `indexedDB` does not exist. Callers must reach this from an effect or
 * an event handler, never during render.
 *
 * Which database is opened depends on the active profile. Profiles are separated by
 * being different databases rather than by a column every query has to remember to
 * filter on, so one profile cannot read another's rows even by mistake.
 */
export function getDatabase(): Promise<IDBPDatabase<EngThaiDB>> {
  if (!isDatabaseAvailable()) {
    return Promise.reject(
      new DatabaseUnavailableError(
        "IndexedDB is not available. The database can only be opened in the browser.",
      ),
    );
  }

  const name = activeDbName();
  // A cached handle to the profile we just left would quietly write to the wrong person.
  if (dbPromise && openName !== name) void closeDatabase();
  openName = name;

  dbPromise ??= openDB<EngThaiDB>(name, DB_VERSION, {
    async upgrade(db, oldVersion, newVersion, tx) {
      for (const migration of migrationsToRun(MIGRATIONS, oldVersion, newVersion ?? DB_VERSION)) {
        await migration.migrate({ db, tx });
      }
    },
    blocked() {
      console.warn("EngThai Trainer is open in another tab on an older version. Close it to continue.");
    },
    blocking() {
      // Another tab wants to upgrade; release our handle so it is not stuck.
      void closeDatabase();
    },
    terminated() {
      dbPromise = null;
    },
  }).catch((error) => {
    dbPromise = null;
    throw error;
  });

  return dbPromise;
}

export async function closeDatabase(): Promise<void> {
  if (!dbPromise) return;
  const pending = dbPromise;
  dbPromise = null;
  openName = null;
  try {
    (await pending).close();
  } catch {
    // Already closed or never opened successfully.
  }
}

/**
 * Drops the whole database.
 *
 * A delete is blocked while any other connection is open — typically the app in a second
 * tab. Resolving on `blocked` would be a lie: the delete is still pending, and the next
 * `getDatabase()` would queue behind it and never settle. So a block is surfaced as a
 * real, explainable failure instead.
 */
export async function deleteDatabase(timeoutMs = 5000, name = activeDbName()): Promise<void> {
  await closeDatabase();

  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    let blocked = false;

    const timer = setTimeout(() => {
      reject(
        new Error(
          blocked
            ? "Another tab has EngThai Trainer open and is holding the database. Close it and try again."
            : "Deleting the database timed out.",
        ),
      );
    }, timeoutMs);

    const settle = (fn: () => void) => {
      clearTimeout(timer);
      fn();
    };

    request.onsuccess = () => settle(resolve);
    request.onerror = () => settle(() => reject(request.error));
    request.onblocked = () => {
      blocked = true;
    };
  });
}
