import type { IDBPDatabase, IDBPTransaction } from "idb";
import type { EngThaiDB, StoreName } from "../schema";

export type MigrationContext = {
  db: IDBPDatabase<EngThaiDB>;
  /** The upgrade transaction, so a migration can backfill rows in the same atomic step. */
  tx: IDBPTransaction<EngThaiDB, StoreName[], "versionchange">;
};

export type Migration = {
  /** The database version this migration produces. */
  version: number;
  description: string;
  migrate: (ctx: MigrationContext) => void | Promise<void>;
};

/**
 * The migrations a database at `fromVersion` must replay to reach `toVersion`.
 *
 * A fresh database reports version 0, so it replays the whole ladder from v1;
 * a database three releases behind replays each intervening step in order. This
 * is the reason migrations are additive and never rewritten after release.
 */
export function migrationsToRun<T extends { version: number }>(
  migrations: readonly T[],
  fromVersion: number,
  toVersion: number,
): T[] {
  return migrations
    .filter((m) => m.version > fromVersion && m.version <= toVersion)
    .sort((a, b) => a.version - b.version);
}
