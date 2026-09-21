import type { Settings } from "@/lib/models";
import { checkConsent, type ConsentState } from "./consent";
import { disabledProvider, NOT_CONFIGURED_MESSAGE } from "./disabled";
import { aiFailure, type AIProvider, type AIRequest, type AIResponse, type AIResult } from "./types";
import type { Capability } from "./schemas";
import { validateResponse } from "./validate";

export const NO_CONSENT_MESSAGE =
  "Nothing has been sent. Turn on AI assistance in Settings and confirm what may be shared first.";

/**
 * Providers this build can use.
 *
 * Exactly one, and it does nothing. **No credentialed provider is registered, and none
 * can be**: this app is a static export with no server, so any key a browser-side
 * provider used would be readable by anyone who opened the page. A real provider
 * requires a server-side adapter that holds the secret and exposes a plain endpoint —
 * see docs/ai.md. That adapter is deliberately not built here.
 */
const PROVIDERS: Record<string, AIProvider> = {
  [disabledProvider.id]: disabledProvider,
};

export function listProviders(): AIProvider[] {
  return Object.values(PROVIDERS);
}

/** Always resolves to something callable, so no caller needs a null check. */
export function resolveProvider(settings: Pick<Settings, "ai">): AIProvider {
  return PROVIDERS[settings.ai.provider] ?? disabledProvider;
}

export type AIStatus = {
  providerId: string;
  providerLabel: string;
  /** A provider exists and can actually make calls. */
  providerAvailable: boolean;
  enabled: boolean;
  consentGivenAt: number | null;
  /** True only when a request would genuinely be sent. */
  ready: boolean;
  /** One line describing the real state, for the Settings screen. */
  summary: string;
};

export function aiStatus(settings: Pick<Settings, "ai">): AIStatus {
  const provider = resolveProvider(settings);
  const consent = checkConsent(settings.ai, provider.available);

  const summary = !provider.available
    ? "Not configured — no provider is available in this build"
    : !settings.ai.enabled
      ? "Available, but switched off"
      : consent.allowed
        ? `On — ${provider.label}`
        : "On, but waiting for you to confirm what may be shared";

  return {
    providerId: provider.id,
    providerLabel: provider.label,
    providerAvailable: provider.available,
    enabled: settings.ai.enabled,
    consentGivenAt: settings.ai.consentGivenAt,
    ready: consent.allowed,
    summary,
  };
}

/**
 * The only way to reach a provider.
 *
 * Three things happen in order, and none can be skipped by a caller: consent is checked
 * *before* the request is built, the provider is called, and whatever comes back is
 * validated against its schema. A failure at any step returns an `AIResult` rather than
 * throwing, so a feature that uses AI degrades to "not available" instead of breaking.
 */
export async function runCapability<K extends Capability>(
  capability: K,
  request: AIRequest[K],
  settings: Pick<Settings, "ai">,
  provider: AIProvider = resolveProvider(settings),
): Promise<AIResult<AIResponse[K]>> {
  const consent = checkConsent(settings.ai as ConsentState, provider.available);

  if (!consent.allowed) {
    return consent.reason === "no-consent"
      ? aiFailure("no-consent", NO_CONSENT_MESSAGE)
      : aiFailure("not-configured", NOT_CONFIGURED_MESSAGE);
  }

  let raw: AIResult<unknown>;
  try {
    raw = await callProvider(capability, request, provider);
  } catch (error) {
    // A provider that throws is a bug in the adapter, not something to crash a lesson over.
    return aiFailure("error", `The AI provider failed: ${error instanceof Error ? error.message : error}`);
  }

  if (!raw.ok) return raw;

  // Even a provider that returns a typed value is re-validated: the type is a promise,
  // the schema is a check.
  return validateResponse(capability, raw.value);
}

function callProvider<K extends Capability>(
  capability: K,
  request: AIRequest[K],
  provider: AIProvider,
): Promise<AIResult<unknown>> {
  switch (capability) {
    case "explainMistake":
      return provider.explainMistake(request as AIRequest["explainMistake"]);
    case "generateLesson":
      return provider.generateLesson(request as AIRequest["generateLesson"]);
    case "generateSentences":
      return provider.generateSentences(request as AIRequest["generateSentences"]);
    case "extractVocabulary":
      return provider.extractVocabulary(request as AIRequest["extractVocabulary"]);
    case "translate":
      return provider.translate(request as AIRequest["translate"]);
    case "generateBlankExercise":
      return provider.generateBlankExercise(request as AIRequest["generateBlankExercise"]);
    case "followUpQuestions":
      return provider.followUpQuestions(request as AIRequest["followUpQuestions"]);
    default: {
      const exhaustive: never = capability;
      throw new Error(`Unknown capability: ${String(exhaustive)}`);
    }
  }
}
