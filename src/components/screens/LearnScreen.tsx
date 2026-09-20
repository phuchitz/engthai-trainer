"use client";

import Link from "next/link";
import { useLibrary } from "@/hooks/useLibrary";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/States";

export function LearnScreen() {
  const { status, error, sentenceCount } = useLibrary();

  if (status === "idle" || status === "loading") return <LoadingState label="Preparing a session…" />;
  if (status === "error") return <ErrorState message={error ?? "Unknown error"} />;

  if (sentenceCount === 0) {
    return (
      <EmptyState
        title="Nothing to practise"
        description="Add some sentences before starting a session."
        action={
          <Link
            href="/lessons"
            className="bg-accent text-accent-foreground rounded-lg px-4 py-2 text-sm font-medium"
          >
            Browse lessons
          </Link>
        }
      />
    );
  }

  return (
    <EmptyState
      title="No session in progress"
      description="The exercise loop is built on top of the answer checker and the scheduler, so it arrives once both are in place. Pick a lesson to queue one up."
      action={
        <Link
          href="/lessons"
          className="bg-accent text-accent-foreground rounded-lg px-4 py-2 text-sm font-medium"
        >
          Choose a lesson
        </Link>
      }
    />
  );
}
