import { describe, it, expect } from "vitest";
import { disabledProvider, extractJson, runCapability, validateResponse, type AIProvider } from "@/lib/ai";
import { defaultSettings, type Settings } from "@/lib/models";

const NOW = 1_700_000_000_000;

/** Consent granted and a provider present, so validation is what is under test. */
const READY: Settings = (() => {
  const base = defaultSettings(NOW);
  return { ...base, ai: { ...base.ai, enabled: true, consentGivenAt: NOW } };
})();

/**
 * A provider that hands back whatever a test tells it to, standing in for a model.
 *
 * Cast on purpose: the point of these tests is a provider returning shapes the
 * interface forbids, which is exactly what the type system cannot express — and exactly
 * what the validation layer exists to catch at runtime.
 */
function mockProvider(value: unknown, override: Partial<AIProvider> = {}): AIProvider {
  const respond = async () => ({ ok: true as const, value });
  return {
    ...disabledProvider,
    id: "mock",
    label: "Mock",
    available: true,
    explainMistake: respond,
    generateLesson: respond,
    generateSentences: respond,
    extractVocabulary: respond,
    translate: respond,
    generateBlankExercise: respond,
    followUpQuestions: respond,
    ...override,
  } as unknown as AIProvider;
}

describe("validateResponse — accepting good output", () => {
  it("accepts a well-formed mistake explanation and fills defaults", () => {
    const result = validateResponse("explainMistake", {
      explanationTh: "ต้องมี verb to be",
      corrected: "I am very hungry.",
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.examples).toEqual([]);
  });

  it("accepts a generated lesson", () => {
    const result = validateResponse("generateLesson", {
      title: "Code review",
      titleTh: "รีวิวโค้ด",
      category: "software",
      level: "B1",
      sentences: [{ english: "Ship it.", thai: "ปล่อยเลย", level: "B1" }],
    });
    expect(result.ok).toBe(true);
  });

  it("accepts a translation and trims whitespace", () => {
    const result = validateResponse("translate", { thai: "  ฉันหิวมาก  " });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.thai).toBe("ฉันหิวมาก");
  });

  it("accepts an empty vocabulary list, which is a legitimate answer", () => {
    expect(validateResponse("extractVocabulary", []).ok).toBe(true);
  });
});

describe("validateResponse — rejecting bad output", () => {
  it("rejects a missing required field and names it", () => {
    const result = validateResponse("explainMistake", { corrected: "I am very hungry." });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("invalid-response");
      expect(result.issues?.join(" ")).toMatch(/explanationTh/);
    }
  });

  it("rejects an invented CEFR level", () => {
    const result = validateResponse("generateSentences", [
      { english: "Ship it.", thai: "ปล่อยเลย", level: "Z9" },
    ]);
    expect(result.ok).toBe(false);
  });

  it("rejects an invented category", () => {
    const result = validateResponse("generateLesson", {
      title: "x",
      titleTh: "x",
      category: "philosophy",
      level: "B1",
      sentences: [{ english: "a", thai: "ก", level: "B1" }],
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a lesson with no sentences", () => {
    const result = validateResponse("generateLesson", {
      title: "x",
      titleTh: "x",
      category: "daily",
      level: "A1",
      sentences: [],
    });
    expect(result.ok).toBe(false);
  });

  it("rejects an empty string where text was required", () => {
    expect(validateResponse("translate", { thai: "   " }).ok).toBe(false);
  });

  it("rejects a vocabulary item with no Thai side, matching the import rule", () => {
    expect(validateResponse("extractVocabulary", [{ en: "deploy" }]).ok).toBe(false);
  });

  it("rejects a blank exercise with no answers", () => {
    expect(validateResponse("generateBlankExercise", { masked: "I ____ hungry", answers: [] }).ok).toBe(
      false,
    );
  });

  it("rejects an absurdly long lesson rather than accepting a runaway", () => {
    const sentences = Array.from({ length: 60 }, () => ({ english: "a", thai: "ก", level: "A1" }));
    const result = validateResponse("generateLesson", {
      title: "x",
      titleTh: "x",
      category: "daily",
      level: "A1",
      sentences,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects entirely the wrong shape", () => {
    expect(validateResponse("translate", "ฉันหิวมาก").ok).toBe(false);
    expect(validateResponse("translate", null).ok).toBe(false);
    expect(validateResponse("generateSentences", { nope: true }).ok).toBe(false);
  });

  it("caps the reported issues so one broken payload cannot flood the UI", () => {
    const sentences = Array.from({ length: 40 }, () => ({ english: "", thai: "", level: "nope" }));
    const result = validateResponse("generateSentences", sentences);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues!.length).toBeLessThanOrEqual(11);
      expect(result.issues!.at(-1)).toMatch(/more problems/);
    }
  });

  it("never lets an unvalidated field through", () => {
    const result = validateResponse("translate", { thai: "ก", sneaky: "extra" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).not.toHaveProperty("sneaky");
  });
});

describe("runCapability validates even a typed provider result", () => {
  it("passes a good response through", async () => {
    const provider = mockProvider({ thai: "ฉันหิวมาก", alternatives: [] });
    const result = await runCapability("translate", { english: "I am very hungry." }, READY, provider);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.thai).toBe("ฉันหิวมาก");
  });

  it("rejects a provider that lies about its own shape", async () => {
    // The interface says Translation; the adapter returns something else.
    const provider = mockProvider({ translation: "ฉันหิวมาก" });
    const result = await runCapability("translate", { english: "a" }, READY, provider);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid-response");
  });

  it("passes a provider's own failure through untouched", async () => {
    const provider = mockProvider(null, {
      translate: async () => ({ ok: false, reason: "rate-limited", message: "Too many requests" }),
    });

    const result = await runCapability("translate", { english: "a" }, READY, provider);
    expect(result).toMatchObject({ ok: false, reason: "rate-limited" });
  });

  it("turns a thrown error into a failure rather than crashing the lesson", async () => {
    const provider = mockProvider(null, {
      translate: async () => {
        throw new Error("socket hang up");
      },
    });

    const result = await runCapability("translate", { english: "a" }, READY, provider);
    expect(result).toMatchObject({ ok: false, reason: "error" });
    if (!result.ok) expect(result.message).toMatch(/socket hang up/);
  });
});

describe("extractJson", () => {
  it("reads plain JSON", () => {
    expect(extractJson('{"thai":"ก"}')).toEqual({ thai: "ก" });
  });

  it("reads a fenced block", () => {
    expect(extractJson('```json\n{"thai":"ก"}\n```')).toEqual({ thai: "ก" });
  });

  it("reads JSON wrapped in prose, which models routinely produce", () => {
    expect(extractJson('Sure! Here you go: {"thai":"ก"} Hope that helps.')).toEqual({ thai: "ก" });
  });

  it("reads an array", () => {
    expect(extractJson('[{"en":"a","th":"ก"}]')).toEqual([{ en: "a", th: "ก" }]);
  });

  it("is not fooled by a brace inside a string", () => {
    expect(extractJson('{"thai":"a } b"}')).toEqual({ thai: "a } b" });
  });

  it("handles an escaped quote inside a string", () => {
    expect(extractJson('{"thai":"say \\"hi\\""}')).toEqual({ thai: 'say "hi"' });
  });

  it("returns undefined for text with no JSON, rather than guessing", () => {
    expect(extractJson("I am afraid I cannot do that.")).toBeUndefined();
  });

  it("returns undefined for truncated JSON", () => {
    expect(extractJson('{"thai":"ก"')).toBeUndefined();
  });

  it("feeds straight into validation", () => {
    const raw = extractJson('Here: ```json\n{"thai":"ฉันหิวมาก","alternatives":[]}\n```');
    expect(validateResponse("translate", raw).ok).toBe(true);
  });
});
