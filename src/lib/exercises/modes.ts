import type { Language } from "@/lib/answer";
import type { Direction, ExerciseMode } from "@/lib/models";

export type ModeInfo = {
  id: ExerciseMode;
  label: string;
  labelTh: string;
  /** Which progress card this mode exercises. */
  direction: Direction;
  /** The language the learner produces. */
  answerLanguage: Language;
  /** The language of the prompt, which is what the replay button speaks. */
  promptLanguage: Language;
  instruction: string;
  instructionTh: string;
  /**
   * Whether a graded answer in this mode may move the schedule.
   *
   * False for recognition modes. Picking the right sentence from four options is a
   * different, easier act than producing it, and letting it advance a card scheduled
   * for production would buy an interval the learner has not earned — the same reason
   * drilling a card until it is right cannot extend one.
   */
  schedules: boolean;
};

/**
 * Four modes train producing English, so they share the `th2en` card — audio, a Thai
 * prompt and a gapped sentence are different ways of asking for the same skill, and
 * splitting them would fragment one skill across several schedules.
 *
 * Sentence Builder is the exception: it is the only mode that asks for Thai, and it asks
 * by tapping tokens rather than typing, which is how Thai production is trained here —
 * a typed Thai answer is graded with no tolerance at all.
 *
 * Multiple Choice shares the `th2en` card too, so a mistake shows up against the skill
 * it belongs to, but it is **practice only**: see `schedules`.
 */
export const MODE_INFO: Record<ExerciseMode, ModeInfo> = {
  dictation: {
    id: "dictation",
    label: "Dictation",
    labelTh: "ตามคำบอก",
    direction: "th2en",
    answerLanguage: "en",
    promptLanguage: "en",
    instruction: "Type what you hear, in English",
    instructionTh: "พิมพ์สิ่งที่ได้ยินเป็นภาษาอังกฤษ",
    schedules: true,
  },
  translate: {
    id: "translate",
    label: "Thai to English",
    labelTh: "ไทยเป็นอังกฤษ",
    direction: "th2en",
    answerLanguage: "en",
    promptLanguage: "th",
    instruction: "Translate this sentence into English",
    instructionTh: "แปลประโยคนี้เป็นภาษาอังกฤษ",
    schedules: true,
  },
  fillBlank: {
    id: "fillBlank",
    label: "Fill in the Blank",
    labelTh: "เติมคำในช่องว่าง",
    direction: "th2en",
    answerLanguage: "en",
    promptLanguage: "th",
    instruction: "Fill in the missing words",
    instructionTh: "เติมคำที่หายไป",
    schedules: true,
  },
  wordOrder: {
    id: "wordOrder",
    label: "Sentence Builder",
    labelTh: "เรียงประโยค",
    direction: "en2th",
    answerLanguage: "th",
    promptLanguage: "en",
    instruction: "Tap the words in order to build the Thai sentence",
    instructionTh: "แตะคำตามลำดับเพื่อเรียงเป็นประโยคภาษาไทย",
    schedules: true,
  },
  speak: {
    id: "speak",
    label: "Speaking",
    labelTh: "การพูด",
    direction: "th2en",
    answerLanguage: "en",
    promptLanguage: "en",
    instruction: "Listen, then say the sentence out loud",
    instructionTh: "ฟังแล้วพูดประโยคนั้นออกมาดัง ๆ",
    schedules: true,
  },
  multipleChoice: {
    id: "multipleChoice",
    label: "Multiple Choice",
    labelTh: "เลือกคำตอบ",
    direction: "th2en",
    answerLanguage: "en",
    promptLanguage: "th",
    instruction: "Choose the English sentence that matches",
    instructionTh: "เลือกประโยคภาษาอังกฤษที่ตรงกัน",
    schedules: false,
  },
};

export const IMPLEMENTED_MODES = Object.keys(MODE_INFO) as (keyof typeof MODE_INFO)[];

export type ImplementedMode = (typeof IMPLEMENTED_MODES)[number];

/** Whether an answer in this mode may move the card's schedule. */
export function modeSchedules(mode: ExerciseMode): boolean {
  return MODE_INFO[mode].schedules;
}

export function isImplementedMode(value: unknown): value is ImplementedMode {
  return typeof value === "string" && (IMPLEMENTED_MODES as string[]).includes(value);
}
