import type { Migration } from "./types";
import { v1 } from "./v1";
import { v2 } from "./v2";
import { v3 } from "./v3";
import { v4 } from "./v4";

/**
 * Ordered, append-only. Never edit a released migration: a learner three versions
 * behind replays every entry here in order, so changing an old one changes history.
 */
export const MIGRATIONS: readonly Migration[] = [v1, v2, v3, v4];

export { migrationsToRun } from "./types";
export type { Migration, MigrationContext } from "./types";
