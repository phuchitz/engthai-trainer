import { describe, it, expect } from "vitest";
import {
  aiStatus,
  CAPABILITIES,
  checkConsent,
  describeRequest,
  disabledProvider,
  listProviders,
  NEVER_SENT,
  NOT_CONFIGURED_MESSAGE,
  resolveProvider,
  runCapability,
  type AIProvider,
  type AIRequest,
  type Capability,
} from "@/lib/ai";
import { defaultSettings, settingsSchema, type Settings } from "@/lib/models";

const NOW = 1_700_000_000_000;

const base = defaultSettings(NOW);

const withAi = (patch: Partial<Settings["ai"]>): Settings => ({
  ...base,
  ai: { ...base.ai, ...patch },
});

/** A request per capability, used to drive every table-driven test below. */
const REQUESTS: { [K in Capability]: AIRequest[K] } = {
  explainMistake: { english: "a", thai: "ก", learnerAnswer: "x", expectedAnswer: "a" },
  generateLesson: { topic: "code review", category: "software", level: "B1", count: 5 },
  generateSentences: { level: "A2", count: 3 },
  extractVocabulary: { english: "a", thai: "ก" },
  translate: { english: "a" },
  generateBlankExercise: { english: "a b c", blanks: 1 },
  followUpQuestions: { english: "a", thai: "ก", level: "A1" },
};

describe("the default is no AI at all", () => {
  it("registers only the disabled provider", () => {
    expect(listProviders().map((p) => p.id)).toEqual(["none"]);
  });

  it("resolves to the disabled provider for fresh settings", () => {
    expect(resolveProvider(base).id).toBe("none");
    expect(resolveProvider(base).available).toBe(false);
  });

  it("falls back to the disabled provider for an unknown provider id", () => {
    const settings = withAi({ provider: "anthropic" });
    expect(resolveProvider(settings).id).toBe("none");
  });

  it("reports itself as unavailable rather than pretending", () => {
    expect(disabledProvider.available).toBe(false);
  });
});

describe("disabled provider — every capability", () => {
  it.each(CAPABILITIES)("refuses %s kindly", async (capability) => {
    const method = disabledProvider[capability as keyof AIProvider];
    const result = await (method as (r: unknown) => Promise<unknown>).call(
      disabledProvider,
      REQUESTS[capability],
    );

    expect(result).toEqual({ ok: false, reason: "not-configured", message: NOT_CONFIGURED_MESSAGE });
  });

  it("says core features still work", () => {
    expect(NOT_CONFIGURED_MESSAGE).toMatch(/works without it/);
  });

  it("never throws, so a caller has one path to handle", async () => {
    for (const capability of CAPABILITIES) {
      await expect(runCapability(capability, REQUESTS[capability] as never, base)).resolves.toMatchObject({
        ok: false,
      });
    }
  });
});

describe("consent gating", () => {
  it("blocks when no provider is available, whatever consent says", () => {
    const settings = withAi({ enabled: true, consentGivenAt: NOW });
    expect(checkConsent(settings.ai, false)).toEqual({ allowed: false, reason: "not-configured" });
  });

  it("blocks when the provider exists but AI is switched off", () => {
    expect(checkConsent(withAi({ enabled: false, consentGivenAt: NOW }).ai, true)).toEqual({
      allowed: false,
      reason: "not-configured",
    });
  });

  it("blocks when enabled but not yet agreed — enabling is not agreement", () => {
    expect(checkConsent(withAi({ enabled: true, consentGivenAt: null }).ai, true)).toEqual({
      allowed: false,
      reason: "no-consent",
    });
  });

  it("allows only when both gates are open", () => {
    expect(checkConsent(withAi({ enabled: true, consentGivenAt: NOW }).ai, true)).toEqual({
      allowed: true,
    });
  });

  it("refuses at the call site before any request is built", async () => {
    let called = false;
    const spy: AIProvider = {
      ...disabledProvider,
      available: true,
      translate: async () => {
        called = true;
        return { ok: true, value: { thai: "ก", alternatives: [] } };
      },
    };

    const result = await runCapability(
      "translate",
      { english: "hello" },
      withAi({ enabled: true, consentGivenAt: null }),
      spy,
    );

    expect(called).toBe(false);
    expect(result).toMatchObject({ ok: false, reason: "no-consent" });
  });
});

describe("aiStatus reflects the real state", () => {
  it("is not configured by default", () => {
    const status = aiStatus(base);
    expect(status.providerId).toBe("none");
    expect(status.providerAvailable).toBe(false);
    expect(status.ready).toBe(false);
    expect(status.summary).toMatch(/Not configured/);
  });

  it("stays not-ready even when enabled and agreed, while no provider exists", () => {
    const status = aiStatus(withAi({ enabled: true, consentGivenAt: NOW }));
    expect(status.ready).toBe(false);
  });
});

describe("settings never carry a credential", () => {
  it("has no apiKey field", () => {
    expect(base.ai).not.toHaveProperty("apiKey");
  });

  it("strips an apiKey supplied by an old record or a hand-edited backup", () => {
    const legacy = {
      id: "singleton",
      createdAt: NOW,
      updatedAt: NOW,
      ai: { enabled: true, provider: "openai", apiKey: "sk-secret", model: null },
    };

    const parsed = settingsSchema.parse(legacy);
    expect(parsed.ai).not.toHaveProperty("apiKey");
    expect(JSON.stringify(parsed)).not.toContain("sk-secret");
  });

  it("defaults consent to null", () => {
    expect(base.ai.consentGivenAt).toBeNull();
  });
});

describe("disclosure", () => {
  it("covers every capability", () => {
    for (const capability of CAPABILITIES) {
      const disclosure = describeRequest(capability, REQUESTS[capability] as never);
      expect(disclosure.capability).toBe(capability);
      expect(disclosure.purpose.length).toBeGreaterThan(0);
      expect(disclosure.fields.length).toBeGreaterThan(0);
    }
  });

  it("shows the literal values that would leave the device", () => {
    const disclosure = describeRequest("explainMistake", {
      english: "I am very hungry.",
      thai: "ฉันหิวมาก",
      learnerAnswer: "I very hungry",
      expectedAnswer: "I am very hungry.",
    });

    const values = disclosure.fields.map((f) => f.value);
    expect(values).toContain("I very hungry");
    expect(values).toContain("ฉันหิวมาก");
  });

  it("omits fields that were not supplied rather than sending empty ones", () => {
    const withoutTopic = describeRequest("generateSentences", { level: "A2", count: 3 });
    expect(withoutTopic.fields.map((f) => f.label)).not.toContain("Topic");

    const withTopic = describeRequest("generateSentences", { level: "A2", count: 3, topic: "travel" });
    expect(withTopic.fields.map((f) => f.label)).toContain("Topic");
  });

  it("lists each context sentence separately, so none is hidden in a count", () => {
    const disclosure = describeRequest("translate", {
      english: "hello",
      context: ["one", "two"],
    });
    expect(disclosure.fields.map((f) => f.value)).toEqual(["hello", "one", "two"]);
  });

  it("states what is never sent", () => {
    expect(NEVER_SENT.join(" ")).toMatch(/answer history/i);
    expect(NEVER_SENT.join(" ")).toMatch(/audio/i);
  });
});
