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
};

export const CATEGORY_INFO: Record<Category, CategoryInfo> = {
  daily: {
    id: "daily",
    label: "Daily Conversation",
    labelTh: "บทสนทนาประจำวัน",
    description: "Everyday exchanges: greetings, asking for things, small talk.",
  },
  software: {
    id: "software",
    label: "Software Engineering",
    labelTh: "วิศวกรรมซอฟต์แวร์",
    description: "Code review, architecture, debugging and release vocabulary.",
  },
  meetings: {
    id: "meetings",
    label: "Meetings",
    labelTh: "การประชุม",
    description: "Standups, planning, disagreeing politely and summarising.",
  },
  interviews: {
    id: "interviews",
    label: "Technical Interviews",
    labelTh: "สัมภาษณ์งานสายเทคนิค",
    description: "Explaining your reasoning out loud under time pressure.",
  },
  workplace: {
    id: "workplace",
    label: "Workplace English",
    labelTh: "ภาษาอังกฤษในที่ทำงาน",
    description: "Email, chat, time off and everything around the actual work.",
  },
  travel: {
    id: "travel",
    label: "Travel",
    labelTh: "การเดินทาง",
    description: "Airports, hotels, directions and getting unstuck abroad.",
  },
  custom: {
    id: "custom",
    label: "Custom Lessons",
    labelTh: "บทเรียนของฉัน",
    description: "Sentences you added or imported yourself.",
  },
};

export const CATEGORY_LIST: CategoryInfo[] = CATEGORIES.map((id) => CATEGORY_INFO[id]);

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}
