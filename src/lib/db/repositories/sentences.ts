import { getDatabase } from "../client";
import { sentenceSchema, type Sentence } from "@/lib/models";

export async function putSentence(sentence: Sentence): Promise<Sentence> {
  const parsed = sentenceSchema.parse(sentence);
  const db = await getDatabase();
  await db.put("sentences", parsed);
  return parsed;
}

export async function putSentences(sentences: Sentence[]): Promise<void> {
  const parsed = sentences.map((s) => sentenceSchema.parse(s));
  const db = await getDatabase();
  const tx = db.transaction("sentences", "readwrite");
  await Promise.all(parsed.map((s) => tx.store.put(s)));
  await tx.done;
}

export async function getSentence(id: string): Promise<Sentence | undefined> {
  const db = await getDatabase();
  return db.get("sentences", id);
}

export async function getSentences(ids: string[]): Promise<Sentence[]> {
  const db = await getDatabase();
  const tx = db.transaction("sentences", "readonly");
  const found = await Promise.all(ids.map((id) => tx.store.get(id)));
  await tx.done;
  return found.filter((s): s is Sentence => s !== undefined);
}

export async function listSentences(): Promise<Sentence[]> {
  const db = await getDatabase();
  return db.getAll("sentences");
}

export async function listSentencesByLesson(lessonId: string): Promise<Sentence[]> {
  const db = await getDatabase();
  return db.getAllFromIndex("sentences", "by-lesson", lessonId);
}

export async function listSentencesByTag(tag: string): Promise<Sentence[]> {
  const db = await getDatabase();
  return db.getAllFromIndex("sentences", "by-tag", tag);
}

export async function deleteSentence(id: string): Promise<void> {
  const db = await getDatabase();
  await db.delete("sentences", id);
}

export async function countSentences(): Promise<number> {
  const db = await getDatabase();
  return db.count("sentences");
}
