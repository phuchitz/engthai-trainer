"use client";

import { joinTokens, remainingTiles } from "@/lib/exercises";
import { useStudyStore } from "@/stores/useStudyStore";

export function WordOrderInput() {
  const { wordOrder, placed, placeToken, removeToken, clearPlaced } = useStudyStore();
  if (!wordOrder) return null;

  const remaining = remainingTiles(wordOrder, placed);

  return (
    <div className="space-y-3">
      <div
        role="group"
        aria-label="Your sentence"
        className="border-border bg-background min-h-16 rounded-lg border p-3"
      >
        {placed.length === 0 ? (
          <p className="text-muted text-sm">Tap the words below to build the sentence.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {placed.map((token) => (
                <button
                  key={token.id}
                  type="button"
                  onClick={() => removeToken(token.id)}
                  lang="th"
                  className="bg-accent text-accent-foreground rounded-md px-3 py-1.5 text-base"
                  aria-label={`Remove ${token.text}`}
                >
                  {token.text}
                </button>
              ))}
            </div>
            <p lang="th" className="text-muted mt-3 text-sm">
              {joinTokens(placed, "th")}
            </p>
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Available words">
        {remaining.map((token) => (
          <button
            key={token.id}
            type="button"
            onClick={() => placeToken(token)}
            lang="th"
            className="border-border bg-surface-muted rounded-md border px-3 py-1.5 text-base"
          >
            {token.text}
          </button>
        ))}
        {remaining.length === 0 ? <p className="text-muted text-sm">All words placed.</p> : null}
      </div>

      {placed.length > 0 ? (
        <button type="button" onClick={clearPlaced} className="text-muted text-xs underline">
          Clear
        </button>
      ) : null}
    </div>
  );
}
