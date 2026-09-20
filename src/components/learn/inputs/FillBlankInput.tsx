"use client";

import { useStudyStore } from "@/stores/useStudyStore";

export function FillBlankInput() {
  const { fillBlank, blankAnswers, setBlankAnswer } = useStudyStore();
  if (!fillBlank) return null;

  const blankPositions = new Map(fillBlank.blanks.map((blank, i) => [blank.index, i]));

  return (
    <div>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-3 text-lg leading-relaxed">
        {fillBlank.tokens.map((token, index) => {
          const blankIndex = blankPositions.get(index);
          if (blankIndex === undefined) return <span key={index}>{token}</span>;

          return (
            <input
              key={index}
              value={blankAnswers[blankIndex] ?? ""}
              onChange={(e) => setBlankAnswer(blankIndex, e.target.value)}
              // Width follows the answer length, which is a hint the learner would get
              // from a printed gap anyway.
              size={Math.max(6, token.length + 2)}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              lang="en"
              aria-label={`Blank ${blankIndex + 1} of ${fillBlank.blanks.length}`}
              className="border-accent bg-background focus:border-foreground inline-block border-b-2 px-1 py-0.5 text-center text-lg outline-none"
            />
          );
        })}
      </p>
      <p className="text-muted mt-3 text-xs">
        {fillBlank.blanks.length === 1
          ? "One word is missing."
          : `${fillBlank.blanks.length} words are missing. Only these are scored.`}
      </p>
    </div>
  );
}
