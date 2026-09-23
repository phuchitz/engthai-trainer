"use client";

import Link from "next/link";
import { useStudyStore } from "@/stores/useStudyStore";

/**
 * Options as a radio group.
 *
 * Radios rather than buttons because exactly one may be chosen and the browser then
 * gives arrow-key navigation, the right announcement and the right focus behaviour for
 * free. The number shortcut is a convenience on top, not the only way in.
 */
export function MultipleChoiceInput() {
  const { multipleChoice, choice, setChoice, phase } = useStudyStore();
  const graded = phase === "graded";

  if (!multipleChoice) {
    return (
      <div className="border-border space-y-3 rounded-lg border border-dashed p-4">
        <p className="text-warning text-sm font-medium">Not enough sentences yet</p>
        <p className="text-muted text-sm">
          A multiple-choice question needs other sentences to offer as alternatives, and this library has too
          few. The wrong answers have to be real sentences — this app will not invent one to fill a gap.
        </p>
        <Link href="/data" className="text-accent inline-block text-sm underline">
          Import more sentences
        </Link>
      </div>
    );
  }

  return (
    <div role="radiogroup" aria-label="Answer options" className="space-y-2">
      {multipleChoice.options.map((option, index) => {
        const selected = choice === index;
        const isAnswer = graded && index === multipleChoice.answerIndex;
        const wrongPick = graded && selected && !isAnswer;

        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={graded}
            onClick={() => setChoice(index)}
            lang="en"
            className={`flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left text-base transition-colors disabled:opacity-100 ${
              isAnswer
                ? "border-success text-success"
                : wrongPick
                  ? "border-danger text-danger"
                  : selected
                    ? "border-accent bg-surface-muted"
                    : "border-border hover:bg-surface-muted"
            }`}
          >
            <span
              aria-hidden
              className="border-border text-muted flex size-6 shrink-0 items-center justify-center rounded border font-mono text-xs"
            >
              {index + 1}
            </span>
            <span>{option.text}</span>
          </button>
        );
      })}

      {!graded ? (
        <p className="text-muted pt-1 text-xs">
          Press 1 to {multipleChoice.options.length} to choose. Recognising a sentence is easier than
          producing one, so this is practice only — it never moves the schedule.
        </p>
      ) : null}
    </div>
  );
}
