"use client";

import { useLibrary } from "@/hooks/useLibrary";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/States";

export function ReviewScreen() {
  const { status, error, dueCount } = useLibrary();

  if (status === "idle" || status === "loading") return <LoadingState label="Checking what is due…" />;
  if (status === "error") return <ErrorState message={error ?? "Unknown error"} />;

  if (dueCount === 0) {
    return (
      <EmptyState
        title="Nothing due right now"
        description="Cards appear here when the scheduler says they are ready. Come back later, or study new material from a lesson."
      />
    );
  }

  return (
    <EmptyState
      title={`${dueCount} cards due`}
      description="The review queue is wired up once the scheduler and the exercise loop exist."
    />
  );
}
