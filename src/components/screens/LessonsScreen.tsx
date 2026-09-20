"use client";

import { useLibrary } from "@/hooks/useLibrary";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/States";

export function LessonsScreen() {
  const { status, error, lessons } = useLibrary();

  if (status === "idle" || status === "loading") return <LoadingState label="Loading lessons…" />;
  if (status === "error") return <ErrorState message={error ?? "Unknown error"} />;

  if (lessons.length === 0) {
    return (
      <EmptyState
        title="No lessons yet"
        description="Lessons group sentences into an ordered deck. Import one, or create your own once editing lands."
      />
    );
  }

  return (
    <ul className="space-y-3">
      {lessons.map((lesson) => (
        <li key={lesson.id} className="border-border bg-surface rounded-xl border p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-medium">{lesson.title}</p>
              <p className="text-muted text-sm" lang="th">
                {lesson.titleTh}
              </p>
            </div>
            <span className="bg-surface-muted text-muted rounded-md px-2 py-1 text-xs">{lesson.level}</span>
          </div>
          {lesson.description ? <p className="text-muted mt-2 text-sm">{lesson.description}</p> : null}
          <p className="text-muted mt-3 text-xs">{lesson.sentenceIds.length} sentences</p>
        </li>
      ))}
    </ul>
  );
}
