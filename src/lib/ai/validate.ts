import { RESPONSE_SCHEMAS, type Capability } from "./schemas";
import { aiFailure, aiOk, type AIResponse, type AIResult } from "./types";

/**
 * Validates whatever a provider returned before anything is allowed to use it.
 *
 * Model output is untrusted input. This accepts a raw value — usually parsed JSON, often
 * wrapped in prose by the model — and either produces a typed result or an
 * `invalid-response` failure carrying the exact paths that were wrong, so a broken
 * integration is diagnosable instead of mysterious.
 */
export function validateResponse<K extends Capability>(capability: K, raw: unknown): AIResult<AIResponse[K]> {
  const parsed = RESPONSE_SCHEMAS[capability].safeParse(raw);

  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, 10).map((issue) => {
      const path = issue.path.join(".");
      return path.length > 0 ? `${path}: ${issue.message}` : issue.message;
    });
    if (parsed.error.issues.length > 10) {
      issues.push(`…and ${parsed.error.issues.length - 10} more problems.`);
    }
    return aiFailure(
      "invalid-response",
      "The AI returned something this app could not read, so nothing was used.",
      issues,
    );
  }

  return aiOk(parsed.data as AIResponse[K]);
}

/**
 * Pulls JSON out of a model reply that may be wrapped in prose or a fenced block.
 *
 * Models routinely answer with "Sure! ```json …```". Rather than demanding perfection
 * from a provider, take the first balanced object or array and let the schema decide
 * whether it is usable.
 */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    // Fall through to a bracket scan.
  }

  const start = candidate.search(/[[{]/);
  if (start < 0) return undefined;

  const open = candidate[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < candidate.length; i++) {
    const char = candidate[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') inString = true;
    else if (char === open) depth += 1;
    else if (char === close) {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(candidate.slice(start, i + 1));
        } catch {
          return undefined;
        }
      }
    }
  }

  return undefined;
}
