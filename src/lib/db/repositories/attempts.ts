import { getDatabase } from "../client";
import { attemptSchema, type Attempt } from "@/lib/models";

/** Append-only: there is deliberately no update function for attempts. */
export async function addAttempt(attempt: Attempt): Promise<Attempt> {
  const parsed = attemptSchema.parse(attempt);
  const db = await getDatabase();
  await db.add("attempts", parsed);
  return parsed;
}

export async function getAttempt(id: string): Promise<Attempt | undefined> {
  const db = await getDatabase();
  return db.get("attempts", id);
}

export async function listAttemptsInRange(fromMs: number, toMs: number): Promise<Attempt[]> {
  const db = await getDatabase();
  return db.getAllFromIndex("attempts", "by-created", IDBKeyRange.bound(fromMs, toMs));
}

export async function listAttemptsForSession(sessionId: string): Promise<Attempt[]> {
  const db = await getDatabase();
  return db.getAllFromIndex("attempts", "by-session", sessionId);
}

export async function listAttemptsForProgress(progressId: string): Promise<Attempt[]> {
  const db = await getDatabase();
  return db.getAllFromIndex("attempts", "by-progress", progressId);
}

export async function countAttempts(): Promise<number> {
  const db = await getDatabase();
  return db.count("attempts");
}
