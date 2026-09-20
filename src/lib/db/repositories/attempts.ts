import { getDatabase } from "../client";
import { attemptSchema, type Attempt } from "@/lib/models";
import { addLocalDays, startOfLocalDay } from "@/lib/srs";

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

/**
 * Every attempt from the local day containing `now`.
 *
 * The XP and scheduling policies are derived from this rather than from a flag on the
 * progress row, so they survive a reload or a second tab.
 */
export async function listAttemptsOnLocalDay(now: number): Promise<Attempt[]> {
  const db = await getDatabase();
  return db.getAllFromIndex(
    "attempts",
    "by-created",
    IDBKeyRange.bound(startOfLocalDay(now), addLocalDays(now, 1) - 1),
  );
}

export async function countAttempts(): Promise<number> {
  const db = await getDatabase();
  return db.count("attempts");
}
