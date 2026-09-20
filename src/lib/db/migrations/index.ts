import type { Migration } from "./types";
import { v1 } from "./v1";

/**
 * Ordered, append-only. Never edit a released migration: a learner three versions
 * behind replays every entry here in order, so changing an old one changes history.
 */
export const MIGRATIONS: readonly Migration[] = [v1];

export { migrationsToRun } from "./types";
export type { Migration, MigrationContext } from "./types";
