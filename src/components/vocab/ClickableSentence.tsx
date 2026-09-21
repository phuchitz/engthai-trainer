"use client";

import { useVocabStore } from "@/stores/useVocabStore";

/**
 * Renders an English sentence with every word tappable.
 *
 * Splitting is done on the raw text so punctuation stays attached visually, while the
 * word handed to the lookup is stripped — the learner taps "tomorrow?" and the panel
 * looks up "tomorrow".
 */
export function ClickableSentence({
  text,
  sentenceId,
  className,
}: {
  text: string;
  sentenceId: string;
  className?: string;
}) {
  const { openPanel, openWord } = useVocabStore();
  const parts = text.split(/(\s+)/);

  return (
    <p className={className} lang="en">
      {parts.map((part, index) => {
        if (/^\s+$/.test(part) || part.length === 0) return <span key={index}>{part}</span>;

        const active = openWord?.word === part && openWord.sentenceId === sentenceId;

        return (
          <button
            key={index}
            type="button"
            onClick={() => openPanel(part, sentenceId)}
            aria-label={`Look up ${part}`}
            className={`hover:decoration-accent rounded underline decoration-dotted underline-offset-4 ${
              active ? "decoration-accent text-accent" : "decoration-border"
            }`}
          >
            {part}
          </button>
        );
      })}
    </p>
  );
}
