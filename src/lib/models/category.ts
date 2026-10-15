import { z } from "zod";

export const CATEGORIES = [
  "daily",
  "software",
  "meetings",
  "interviews",
  "workplace",
  "travel",
  "custom",
] as const;

export const categorySchema = z.enum(CATEGORIES);
export type Category = z.infer<typeof categorySchema>;

/** Applied to rows written before categories existed. */
export const DEFAULT_CATEGORY: Category = "daily";

export type CategoryInfo = {
  id: Category;
  label: string;
  labelTh: string;
  description: string;
  descriptionTh: string;
};

export const CATEGORY_INFO: Record<Category, CategoryInfo> = {
  daily: {
    id: "daily",
    label: "Daily Conversation",
    labelTh: "บทสนทนาประจำวัน",
    description: "Everyday exchanges: greetings, asking for things, small talk.",
    descriptionTh: "บทสนทนาประจำวัน ทักทาย ขอของ และคุยเล่น",
  },
  software: {
    id: "software",
    label: "Software Engineering",
    labelTh: "วิศวกรรมซอฟต์แวร์",
    description: "Code review, architecture, debugging and release vocabulary.",
    descriptionTh: "คำศัพท์เรื่องรีวิวโค้ด สถาปัตยกรรม การแก้บั๊ก และการปล่อยรีลีส",
  },
  meetings: {
    id: "meetings",
    label: "Meetings",
    labelTh: "การประชุม",
    description: "Standups, planning, disagreeing politely and summarising.",
    descriptionTh: "สแตนด์อัพ วางแผน เห็นต่างอย่างสุภาพ และสรุปประเด็น",
  },
  interviews: {
    id: "interviews",
    label: "Technical Interviews",
    labelTh: "สัมภาษณ์งานสายเทคนิค",
    description: "Explaining your reasoning out loud under time pressure.",
    descriptionTh: "อธิบายวิธีคิดออกมาเป็นคำพูดภายใต้เวลาจำกัด",
  },
  workplace: {
    id: "workplace",
    label: "Workplace English",
    labelTh: "ภาษาอังกฤษในที่ทำงาน",
    description: "Email, chat, time off and everything around the actual work.",
    descriptionTh: "อีเมล แชต การลา และเรื่องรอบ ๆ งานจริง",
  },
  travel: {
    id: "travel",
    label: "Travel",
    labelTh: "การเดินทาง",
    description: "Airports, hotels, directions and getting unstuck abroad.",
    descriptionTh: "สนามบิน โรงแรม ถามทาง และการแก้ปัญหาเวลาอยู่ต่างแดน",
  },
  custom: {
    id: "custom",
    label: "Custom Lessons",
    labelTh: "บทเรียนของฉัน",
    description: "Sentences you added or imported yourself.",
    descriptionTh: "ประโยคที่คุณเพิ่มหรือนำเข้าเอง",
  },
};

export const CATEGORY_LIST: CategoryInfo[] = CATEGORIES.map((id) => CATEGORY_INFO[id]);

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}
