import { DEFAULT_CATEGORY } from "@/lib/models";
import type { Migration } from "./types";

export const v2: Migration = {
  version: 2,
  description: "Add sentence categories, with an index, and backfill existing rows.",
  migrate: async ({ tx }) => {
    const sentences = tx.objectStore("sentences");
    sentences.createIndex("by-category", "category");

    // Read everything in one request, then issue all the writes together.
    //
    // The obvious version of this — a cursor loop with `await cursor.update(...)` inside
    // it — silently does nothing in a real browser: awaiting between cursor steps lets
    // the upgrade transaction auto-commit, so the remaining rows are never touched.
    // fake-indexeddb is more forgiving and happily passes that version, which is why
    // this one is written to issue its requests without awaiting in between.
    const rows = await sentences.getAll();
    const needsCategory = rows.filter((row) => !row.category);
    if (needsCategory.length === 0) return;

    // Backfilled inside the upgrade transaction on purpose: a row with no category is
    // absent from the index above, so it would silently vanish from its category listing.
    await Promise.all(needsCategory.map((row) => sentences.put({ ...row, category: DEFAULT_CATEGORY })));
  },
};
