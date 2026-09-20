"use client";

import { useLibrary } from "@/hooks/useLibrary";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/States";
import { StatTile } from "@/components/common/StatTile";

export function DataScreen() {
  const { status, error, sentenceCount, vocabularyCount, lessons } = useLibrary();

  if (status === "idle" || status === "loading") return <LoadingState label="Reading your library…" />;
  if (status === "error") return <ErrorState message={error ?? "Unknown error"} />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Lessons" value={lessons.length} />
        <StatTile label="Sentences" value={sentenceCount} />
        <StatTile label="Vocabulary" value={vocabularyCount} />
      </div>
      <EmptyState
        title="No backups yet"
        description="Your data lives only in this browser, so an exported file is the only copy that survives a cleared profile. Export and import arrive with a dry-run preview so you can see exactly what a file would change."
      />
    </div>
  );
}
