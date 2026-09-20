import { getDatabase } from "../client";
import { studySessionSchema, type StudySession } from "@/lib/models";

export async function putSession(session: StudySession): Promise<StudySession> {
  const parsed = studySessionSchema.parse(session);
  const db = await getDatabase();
  await db.put("sessions", parsed);
  return parsed;
}

export async function getSession(id: string): Promise<StudySession | undefined> {
  const db = await getDatabase();
  return db.get("sessions", id);
}

export async function listRecentSessions(limit = 20): Promise<StudySession[]> {
  const db = await getDatabase();
  const all = await db.getAllFromIndex("sessions", "by-started");
  return all.reverse().slice(0, limit);
}

export async function countSessions(): Promise<number> {
  const db = await getDatabase();
  return db.count("sessions");
}
