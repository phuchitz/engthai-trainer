import type { Lesson, Sentence } from "@/lib/models";

/**
 * Placeholder deck proving the loader works. The real corpus arrives in a later session;
 * ids are stable strings so re-seeding matches existing rows instead of duplicating.
 *
 * Deliberately covers only three of the seven categories, so the empty-category path on
 * the Lessons screen is exercised by real data rather than only by a test.
 */
export const SEED_VERSION = 3;

type SeedSentence = Omit<Sentence, "createdAt" | "updatedAt" | "source">;
type SeedLesson = Omit<Lesson, "createdAt" | "updatedAt" | "source">;

export { SEED_VOCABULARY } from "./vocabulary";

export const SEED_SENTENCES: SeedSentence[] = [
  {
    id: "seed-sentence-0001",
    en: "Where are you going?",
    th: "คุณจะไปไหน",
    enAlternates: ["Where are you headed?"],
    thAlternates: ["คุณกำลังจะไปไหน"],
    transliteration: "khun ja pai nai",
    hint: "ไหน = where",
    notes: "ภาษาไทยวางคำถามไว้ท้ายประโยค แต่ภาษาอังกฤษขึ้นต้นด้วยคำถาม",
    exampleEn: "Where is he going?",
    exampleTh: "เขาจะไปไหน",
    tags: ["everyday", "questions"],
    category: "daily",
    level: "A1",
    lessonIds: ["seed-lesson-basics"],
    vocabIds: ["seed-vocab-where", "seed-vocab-go"],
  },
  {
    id: "seed-sentence-0002",
    en: "I am very hungry.",
    th: "ฉันหิวมาก",
    enAlternates: ["I'm very hungry."],
    thAlternates: [],
    transliteration: "chan hiu mak",
    hint: "มาก = very",
    notes: "ภาษาไทยไม่ต้องมี verb to be ตรงนี้ เพราะ หิว ทำหน้าที่เหมือนคำกริยาอยู่แล้ว",
    exampleEn: "I am very tired.",
    exampleTh: "ฉันเหนื่อยมาก",
    tags: ["everyday"],
    category: "daily",
    level: "A1",
    lessonIds: ["seed-lesson-basics"],
    vocabIds: ["seed-vocab-hungry", "seed-vocab-very"],
  },
  {
    id: "seed-sentence-0003",
    en: "I will call you tomorrow.",
    th: "พรุ่งนี้ฉันจะโทรหาคุณ",
    enAlternates: ["I'll call you tomorrow."],
    thAlternates: ["ฉันจะโทรหาคุณพรุ่งนี้"],
    transliteration: "phrung-nii chan ja tho ha khun",
    hint: "จะ บอกอนาคต",
    notes: "คำบอกเวลามักมาต้นประโยคในภาษาไทย แต่ภาษาอังกฤษนิยมไว้ท้ายประโยค",
    exampleEn: "I will email you tonight.",
    exampleTh: "คืนนี้ฉันจะส่งอีเมลหาคุณ",
    tags: ["everyday", "time"],
    category: "daily",
    level: "A2",
    lessonIds: ["seed-lesson-basics"],
    vocabIds: ["seed-vocab-tomorrow", "seed-vocab-call"],
  },
  {
    id: "seed-sentence-0004",
    en: "Let's deploy this after the review.",
    th: "ดีพลอยตัวนี้หลังรีวิวเสร็จแล้วกัน",
    enAlternates: ["Let us deploy this after the review."],
    thAlternates: [],
    transliteration: "dii-phloi tua nii lang rii-wiu set laeo kan",
    hint: "Let's = ...กันเถอะ / ...กัน",
    notes: "Let's ย่อมาจาก Let us ใช้ชวนทำอะไรร่วมกัน ตามด้วยกริยารูปธรรมดาเสมอ",
    exampleEn: "Let's merge this tomorrow.",
    exampleTh: "พรุ่งนี้ค่อยเมิร์จตัวนี้กัน",
    tags: ["software", "review"],
    category: "software",
    level: "B1",
    lessonIds: [],
    vocabIds: ["seed-vocab-deploy", "seed-vocab-review"],
  },
  {
    id: "seed-sentence-0005",
    en: "Could you take another look at my pull request?",
    th: "ช่วยดู pull request ของผมอีกรอบได้ไหม",
    enAlternates: ["Could you review my pull request again?"],
    thAlternates: ["รบกวนช่วยรีวิว pull request ของผมอีกครั้งได้ไหม"],
    transliteration: "chuai duu pull request khong phom iik rop dai mai",
    hint: "Could you ... ? = ช่วย ... ได้ไหม",
    notes: "Could you สุภาพกว่า Can you และใช้ขอความช่วยเหลือในที่ทำงานได้ปลอดภัยเสมอ",
    exampleEn: "Could you take another look at this test?",
    exampleTh: "ช่วยดูเทสต์ตัวนี้อีกรอบได้ไหม",
    tags: ["software", "requests"],
    category: "software",
    level: "B1",
    lessonIds: [],
    vocabIds: ["seed-vocab-pull-request", "seed-vocab-take-a-look"],
  },
  {
    id: "seed-sentence-0006",
    en: "I don't have any blockers today.",
    th: "วันนี้ผมไม่มีอะไรติดขัด",
    enAlternates: ["I have no blockers today."],
    thAlternates: [],
    transliteration: "wan nii phom mai mii arai tit khat",
    hint: "don't have any = ไม่มี...เลย",
    notes: "ประโยคปฏิเสธใช้ any คู่กับ don't ส่วน no ใช้กับประโยคบอกเล่า เช่น I have no blockers",
    exampleEn: "I don't have any updates today.",
    exampleTh: "วันนี้ผมไม่มีอะไรอัปเดต",
    tags: ["meetings", "standup"],
    category: "meetings",
    level: "A2",
    lessonIds: [],
    vocabIds: ["seed-vocab-blocker", "seed-vocab-today"],
  },
];

export const SEED_LESSONS: SeedLesson[] = [
  {
    id: "seed-lesson-basics",
    title: "Everyday Basics",
    titleTh: "พื้นฐานประจำวัน",
    description: "A short starter set used to verify the seed loader.",
    tags: ["starter"],
    level: "A1",
    sentenceIds: ["seed-sentence-0001", "seed-sentence-0002", "seed-sentence-0003"],
  },
];
