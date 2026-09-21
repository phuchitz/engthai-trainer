import type { Migration } from "./types";

export const v5: Migration = {
  version: 5,
  description: "Strip any stored AI credential from settings.",
  migrate: async ({ tx }) => {
    const settings = tx.objectStore("settings");

    // getAll then batched puts, never an await inside a cursor loop — see v2 and
    // tests/e2e/migration.spec.ts for why that silently does nothing in a real browser.
    const rows = await settings.getAll();

    // An earlier schema had `ai.apiKey`. Settings are written to IndexedDB and copied
    // into every backup file, so a key there would sit in plain text on disk and in
    // every export. Remove it on sight; a credentialed provider belongs behind a
    // server-side adapter that holds its own secret.
    const withKey = rows.filter(
      (row) => row.ai !== undefined && "apiKey" in (row.ai as Record<string, unknown>),
    );
    if (withKey.length === 0) return;

    await Promise.all(
      withKey.map((row) => {
        const ai = { ...(row.ai as Record<string, unknown>) };
        delete ai.apiKey;
        return settings.put({ ...row, ai: ai as typeof row.ai });
      }),
    );
  },
};
