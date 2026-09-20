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
};

/**
 * Four of the five modes train producing English, so they share the `th2en` card —
 * audio, a Thai prompt and a gapped sentence are different ways of asking for the same
 * skill, and splitting them would fragment one skill across several schedules.
 *
 * Sentence Builder is the exception: it is the only mode that asks for Thai, and it asks
 * by tapping tokens rather than typing, which is how Thai production is trained here —
 * a typed Thai answer is graded with no tolerance at all.
 */
export const MODE_INFO: Record<Exclude<ExerciseMode, "multipleChoice">, ModeInfo> = {
  dictation: {
    id: "dictation",
    label: "Dictation",
    labelTh: "ตามคำบอก",
    direction: "th2en",
    answerLanguage: "en",
    promptLanguage: "en",
    instruction: "Type what you hear, in English",
  },
  translate: {
    id: "translate",
    label: "Thai to English",
    labelTh: "ไทยเป็นอังกฤษ",
    direction: "th2en",
    answerLanguage: "en",
    promptLanguage: "th",
    instruction: "Translate this sentence into English",
  },
  fillBlank: {
    id: "fillBlank",
    label: "Fill in the Blank",
    labelTh: "เติมคำในช่องว่าง",
    direction: "th2en",
    answerLanguage: "en",
    promptLanguage: "th",
    instruction: "Fill in the missing words",
  },
  wordOrder: {
    id: "wordOrder",
    label: "Sentence Builder",
    labelTh: "เรียงประโยค",
    direction: "en2th",
    answerLanguage: "th",
    promptLanguage: "en",
    instruction: "Tap the words in order to build the Thai sentence",
  },
  speak: {
    id: "speak",
    label: "Speaking",
    labelTh: "การพูด",
    direction: "th2en",
    answerLanguage: "en",
    promptLanguage: "en",
    instruction: "Listen, then say the sentence out loud",
  },
};

export const IMPLEMENTED_MODES = Object.keys(MODE_INFO) as (keyof typeof MODE_INFO)[];

export type ImplementedMode = (typeof IMPLEMENTED_MODES)[number];

export function isImplementedMode(value: unknown): value is ImplementedMode {
  return typeof value === "string" && (IMPLEMENTED_MODES as string[]).includes(value);
}
