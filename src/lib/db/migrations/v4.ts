import type { Migration } from "./types";

export const v4: Migration = {
  version: 4,
  description: "Record XP on each attempt, so the running total is exact.",
  migrate: async ({ tx }) => {
    const attempts = tx.objectStore("attempts");

    // getAll then batched puts, never an await inside a cursor loop — see v2 and
    // tests/e2e/migration.spec.ts for why that silently does nothing in a real browser.
    const rows = await attempts.getAll();
    const stale = rows.filter((row) => row.xpAwarded === undefined);
    if (stale.length === 0) return;

    // Attempts recorded before XP was written down get zero. The amount cannot be
    // recovered from the verdict alone, and inventing one would corrupt the total.
    await Promise.all(stale.map((row) => attempts.put({ ...row, xpAwarded: 0 })));
  },
};
