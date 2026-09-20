"use client";

import Link from "next/link";
import { useLibrary } from "@/hooks/useLibrary";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/States";
import { StatTile } from "@/components/common/StatTile";

export function DashboardScreen() {
  const { status, error, sentenceCount, vocabularyCount, dueCount, progressCount } = useLibrary();

  if (status === "idle" || status === "loading") return <LoadingState label="Opening your local library…" />;
  if (status === "error") return <ErrorState message={error ?? "Unknown error"} />;

  if (sentenceCount === 0) {
    return (
      <EmptyState
        title="Nothing to study yet"
        description="Your library is empty. Import a deck or load the starter lessons to get going."
        action={
          <Link
            href="/data"
            className="bg-accent text-accent-foreground rounded-lg px-4 py-2 text-sm font-medium"
          >
            Go to Import / Export
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Due now" value={dueCount} hint="across both directions" />
        <StatTile label="Sentences" value={sentenceCount} />
        <StatTile label="Vocabulary" value={vocabularyCount} />
        <StatTile label="Tracked cards" value={progressCount} hint="2 per item" />
      </div>
      <EmptyState
        title="No study history yet"
        description="Streak, accuracy trend and the review heatmap appear once you have completed some attempts. Every figure is derived from the attempt log rather than a stored counter."
        action={
          <Link
            href="/learn"
            className="bg-accent text-accent-foreground rounded-lg px-4 py-2 text-sm font-medium"
          >
            Start learning
          </Link>
        }
      />
    </div>
  );
}
