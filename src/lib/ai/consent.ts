import type { AIRequest, Capability } from "./types";

export type DisclosedField = {
  label: string;
  /** The literal value that would leave the device. Shown verbatim, never summarised. */
  value: string;
};

export type Disclosure = {
  capability: Capability;
  /** What the provider is being asked to do. */
  purpose: string;
  fields: DisclosedField[];
};

const PURPOSE: Record<Capability, string> = {
  explainMistake: "Explain, in Thai, why an answer was wrong",
  generateLesson: "Write a new lesson on a topic you choose",
  generateSentences: "Write practice sentences at a CEFR level",
  extractVocabulary: "Pick out the key words of a sentence",
  translate: "Translate an English sentence into Thai",
  generateBlankExercise: "Turn a sentence into a fill-in-the-blank exercise",
  followUpQuestions: "Suggest follow-up questions to practise",
};

/**
 * Says exactly what would be sent, field by field.
 *
 * Built from the request itself rather than from a written description, so the
 * disclosure cannot drift away from the payload: if a new field is added to a request
 * and not listed here, it shows up in the tests rather than silently in someone's
 * network log.
 */
export function describeRequest<K extends Capability>(capability: K, request: AIRequest[K]): Disclosure {
  const fields: DisclosedField[] = [];
  const add = (label: string, value: string | number | undefined) => {
    if (value === undefined || value === "") return;
    fields.push({ label, value: String(value) });
  };

  switch (capability) {
    case "explainMistake": {
      const r = request as AIRequest["explainMistake"];
      add("The sentence (English)", r.english);
      add("The sentence (Thai)", r.thai);
      add("Your answer", r.learnerAnswer);
      add("The expected answer", r.expectedAnswer);
      break;
    }
    case "generateLesson": {
      const r = request as AIRequest["generateLesson"];
      add("Topic", r.topic);
      add("Category", r.category);
      add("Level", r.level);
      add("How many sentences", r.count);
      break;
    }
    case "generateSentences": {
      const r = request as AIRequest["generateSentences"];
      add("Level", r.level);
      add("How many sentences", r.count);
      add("Topic", r.topic);
      break;
    }
    case "extractVocabulary": {
      const r = request as AIRequest["extractVocabulary"];
      add("The sentence (English)", r.english);
      add("The sentence (Thai)", r.thai);
      break;
    }
    case "translate": {
      const r = request as AIRequest["translate"];
      add("The sentence (English)", r.english);
      (r.context ?? []).forEach((line, i) => add(`Context sentence ${i + 1}`, line));
      break;
    }
    case "generateBlankExercise": {
      const r = request as AIRequest["generateBlankExercise"];
      add("The sentence (English)", r.english);
      add("How many blanks", r.blanks);
      break;
    }
    case "followUpQuestions": {
      const r = request as AIRequest["followUpQuestions"];
      add("The sentence (English)", r.english);
      add("The sentence (Thai)", r.thai);
      add("Level", r.level);
      break;
    }
  }

  return { capability, purpose: PURPOSE[capability], fields };
}

/**
 * What is *never* sent, stated positively so it can be shown to the learner.
 *
 * Worth being explicit: the obvious fear about a local-first app growing an AI feature
 * is that it quietly starts uploading everything.
 */
export const NEVER_SENT = [
  "Your answer history, schedules, streak or statistics",
  "Your settings or any identifier for you or this device",
  "Your whole library — only the one sentence or topic a request names",
  "Any audio: the microphone is never used by an AI feature",
] as const;

export type ConsentState = {
  enabled: boolean;
  consentGivenAt: number | null;
};

export type ConsentCheck = { allowed: true } | { allowed: false; reason: "not-configured" | "no-consent" };

/**
 * Both gates must be open before anything leaves the device: a provider has to be
 * configured, **and** the learner has to have agreed. Turning a provider on is not by
 * itself agreement to send content.
 */
export function checkConsent(state: ConsentState, providerAvailable: boolean): ConsentCheck {
  if (!providerAvailable || !state.enabled) return { allowed: false, reason: "not-configured" };
  if (state.consentGivenAt === null) return { allowed: false, reason: "no-consent" };
  return { allowed: true };
}
