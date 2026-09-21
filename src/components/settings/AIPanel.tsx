"use client";

import { useState } from "react";
import type { Settings } from "@/lib/models";
import { aiStatus, CAPABILITIES, describeRequest, NEVER_SENT, type Capability } from "@/lib/ai";

/** A representative request per capability, so the disclosure shows real shapes. */
const SAMPLES = {
  explainMistake: {
    english: "I am very hungry.",
    thai: "ฉันหิวมาก",
    learnerAnswer: "I very hungry",
    expectedAnswer: "I am very hungry.",
  },
  generateLesson: { topic: "code review", category: "software", level: "B1", count: 10 },
  generateSentences: { level: "A2", count: 5, topic: "standups" },
  extractVocabulary: { english: "I am very hungry.", thai: "ฉันหิวมาก" },
  translate: { english: "I am very hungry." },
  generateBlankExercise: { english: "I am very hungry.", blanks: 2 },
  followUpQuestions: { english: "I am very hungry.", thai: "ฉันหิวมาก", level: "A2" },
} as const;

const CAPABILITY_LABELS: Record<Capability, string> = {
  explainMistake: "Explain a mistake in Thai",
  generateLesson: "Generate a lesson from a topic",
  generateSentences: "Generate sentences at a CEFR level",
  extractVocabulary: "Extract vocabulary from a sentence",
  translate: "Translate into Thai",
  generateBlankExercise: "Build a fill-in-the-blank exercise",
  followUpQuestions: "Suggest follow-up questions",
};

export function AIPanel({
  settings,
  onUpdate,
}: {
  settings: Settings;
  onUpdate: (patch: Partial<Omit<Settings, "id" | "createdAt">>) => void;
}) {
  const status = aiStatus(settings);
  const [showDisclosure, setShowDisclosure] = useState(false);

  const consented = settings.ai.consentGivenAt !== null;

  return (
    <section className="border-border bg-surface space-y-4 rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">AI assistance</h3>
          <p className="text-muted mt-1 text-sm">{status.summary}</p>
        </div>
        <span
          className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs ${
            status.ready ? "border-success/50 text-success" : "border-border text-muted"
          }`}
        >
          {status.ready ? "Active" : status.providerAvailable ? "Off" : "Not configured"}
        </span>
      </div>

      <p className="text-muted text-sm">
        Every part of EngThai Trainer works without AI. Nothing here is required, and nothing leaves this
        device unless you turn it on and confirm what may be shared.
      </p>

      <div className="border-border border-t pt-3">
        <p className="text-muted text-xs tracking-wide uppercase">What it could do</p>
        <ul className="text-muted mt-2 grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
          {CAPABILITIES.map((capability) => (
            <li key={capability}>· {CAPABILITY_LABELS[capability]}</li>
          ))}
        </ul>
      </div>

      <div className="border-border border-t pt-3">
        <button
          type="button"
          onClick={() => setShowDisclosure((open) => !open)}
          aria-expanded={showDisclosure}
          className="text-sm underline"
        >
          {showDisclosure ? "Hide" : "Show"} exactly what would be sent
        </button>

        {showDisclosure ? (
          <div className="mt-3 space-y-4">
            {CAPABILITIES.map((capability) => {
              const disclosure = describeRequest(capability, SAMPLES[capability] as never);
              return (
                <div key={capability} className="border-border rounded-lg border p-3">
                  <p className="text-sm font-medium">{disclosure.purpose}</p>
                  <dl className="mt-2 space-y-1 text-xs">
                    {disclosure.fields.map((field) => (
                      <div key={field.label} className="flex gap-2">
                        <dt className="text-muted w-44 shrink-0">{field.label}</dt>
                        <dd className="font-mono">{field.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              );
            })}

            <div className="border-border rounded-lg border p-3">
              <p className="text-sm font-medium">Never sent</p>
              <ul className="text-muted mt-2 list-disc space-y-0.5 pl-5 text-xs">
                {NEVER_SENT.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </div>

      <div className="border-border space-y-3 border-t pt-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm">Send learning content to an AI provider</p>
            <p className="text-muted text-xs">
              {consented
                ? `Agreed on ${new Date(settings.ai.consentGivenAt!).toLocaleDateString()}`
                : "Not agreed. Every AI call is refused until you do."}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={consented}
            aria-label="Send learning content to an AI provider"
            onClick={() =>
              onUpdate({
                ai: { ...settings.ai, consentGivenAt: consented ? null : Date.now() },
              })
            }
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium ${
              consented ? "bg-accent text-accent-foreground" : "border-border text-muted border"
            }`}
          >
            {consented ? "Agreed" : "Not agreed"}
          </button>
        </div>

        {!status.providerAvailable ? (
          <p className="text-muted text-xs">
            No provider is available in this build, so nothing is sent whatever this is set to. A credentialed
            provider needs a server-side adapter to hold its key — a key in the browser would be readable by
            anyone who opened the page.
          </p>
        ) : null}
      </div>
    </section>
  );
}
