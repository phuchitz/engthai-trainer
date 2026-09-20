import { getDatabase } from "../client";
import { lessonSchema, type Lesson, type Level } from "@/lib/models";

export async function putLesson(lesson: Lesson): Promise<Lesson> {
  const parsed = lessonSchema.parse(lesson);
  const db = await getDatabase();
  await db.put("lessons", parsed);
  return parsed;
}

export async function getLesson(id: string): Promise<Lesson | undefined> {
  const db = await getDatabase();
  return db.get("lessons", id);
}

export async function listLessons(): Promise<Lesson[]> {
  const db = await getDatabase();
  return db.getAll("lessons");
}

export async function listLessonsByLevel(level: Level): Promise<Lesson[]> {
  const db = await getDatabase();
  return db.getAllFromIndex("lessons", "by-level", level);
}

export async function deleteLesson(id: string): Promise<void> {
  const db = await getDatabase();
  await db.delete("lessons", id);
}

export async function countLessons(): Promise<number> {
  const db = await getDatabase();
  return db.count("lessons");
}
