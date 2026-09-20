import { openDB, type IDBPDatabase } from "idb";
import { DB_NAME, DB_VERSION, type EngThaiDB } from "./schema";
import { MIGRATIONS, migrationsToRun } from "./migrations";

let dbPromise: Promise<IDBPDatabase<EngThaiDB>> | null = null;

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
 */
export function getDatabase(): Promise<IDBPDatabase<EngThaiDB>> {
  if (!isDatabaseAvailable()) {
    return Promise.reject(
      new DatabaseUnavailableError(
        "IndexedDB is not available. The database can only be opened in the browser.",
      ),
    );
  }

  dbPromise ??= openDB<EngThaiDB>(DB_NAME, DB_VERSION, {
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
  try {
    (await pending).close();
  } catch {
    // Already closed or never opened successfully.
  }
}

/** Drops the whole database. Used by tests and by a future "reset all data" action. */
export async function deleteDatabase(): Promise<void> {
  await closeDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}
