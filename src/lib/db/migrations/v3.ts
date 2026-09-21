import type { Migration } from "./types";

export const v3: Migration = {
  version: 3,
  description: "Backfill the vocabulary fields added for the word panel.",
  migrate: async ({ tx }) => {
    const vocab = tx.objectStore("vocab");

    // getAll then batched puts, never an await inside a cursor loop: awaiting between
    // cursor steps lets the upgrade transaction auto-commit and the backfill silently
    // stops. See docs and tests/e2e/migration.spec.ts.
    const rows = await vocab.getAll();
    const stale = rows.filter((row) => row.saved === undefined || row.forms === undefined);
    if (stale.length === 0) return;

    await Promise.all(
      stale.map((row) =>
        vocab.put({
          ...row,
          forms: row.forms ?? [],
          contexts: row.contexts ?? [],
          saved: row.saved ?? false,
        }),
      ),
    );
  },
};
