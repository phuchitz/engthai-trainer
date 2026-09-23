import type { Migration } from "./types";

export const v6: Migration = {
  version: 6,
  description: "Drop the unused uiLanguage field from settings.",
  migrate: async ({ tx }) => {
    const settings = tx.objectStore("settings");

    // getAll then batched puts, never an await inside a cursor loop — see v2 and
    // tests/e2e/migration.spec.ts for why that silently does nothing in a real browser.
    const rows = await settings.getAll();

    // Interface language moved to localStorage, alongside the theme and for the same
    // reason: it has to be readable before first paint, or the whole app renders in one
    // language and then swaps. The settings row keeping a copy nothing reads would be a
    // second source of truth that could only ever disagree with the first.
    const stale = rows.filter((row) => "uiLanguage" in (row as Record<string, unknown>));
    if (stale.length === 0) return;

    await Promise.all(
      stale.map((row) => {
        const next = { ...(row as Record<string, unknown>) };
        delete next.uiLanguage;
        return settings.put(next as typeof row);
      }),
    );
  },
};
