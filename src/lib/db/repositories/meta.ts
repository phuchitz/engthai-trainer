import { getDatabase } from "../client";

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const db = await getDatabase();
  const record = await db.get("meta", key);
  return record?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  const db = await getDatabase();
  await db.put("meta", { key, value });
}

export async function deleteMeta(key: string): Promise<void> {
  const db = await getDatabase();
  await db.delete("meta", key);
}
