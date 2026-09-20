import { getDatabase } from "../client";
import { SETTINGS_ID, defaultSettings, settingsSchema, type Settings } from "@/lib/models";

/** Reads the singleton settings row, creating it with defaults on first run. */
export async function loadSettings(now: number = Date.now()): Promise<Settings> {
  const db = await getDatabase();
  const stored = await db.get("settings", SETTINGS_ID);
  if (!stored) {
    const created = defaultSettings(now);
    await db.put("settings", created);
    return created;
  }
  // Parse on read so a row written by an older version gains any new defaults.
  return settingsSchema.parse(stored);
}

export async function saveSettings(
  patch: Partial<Omit<Settings, "id" | "createdAt">>,
  now: number = Date.now(),
): Promise<Settings> {
  const current = await loadSettings(now);
  const next = settingsSchema.parse({ ...current, ...patch, id: SETTINGS_ID, updatedAt: now });
  const db = await getDatabase();
  await db.put("settings", next);
  return next;
}
