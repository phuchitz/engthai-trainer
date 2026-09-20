"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { isCategory, CATEGORY_INFO } from "@/lib/models";
import { useStudyStore } from "@/stores/useStudyStore";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/States";
import { DictationCard } from "@/components/learn/DictationCard";

function ChooseLessonLink({ label = "Choose a category" }: { label?: string }) {
  return (
    <Link
      href="/lessons"
      className="bg-accent text-accent-foreground rounded-lg px-4 py-2 text-sm font-medium"
    >
      {label}
    </Link>
  );
}

function LearnSession() {
  const params = useSearchParams();
  const raw = params.get("category");
  const category = isCategory(raw) ? raw : null;

  const { phase, error, cards, sessionXp, category: active, start } = useStudyStore();

  // The category lives in the URL rather than in memory, so a reload resumes the same
  // category instead of dropping back to an empty screen.
  useEffect(() => {
    if (category && category !== active) void start(category);
  }, [category, active, start]);

  if (!category) {
    return (
      <EmptyState
        title="No category selected"
        description="Dictation plays an English sentence and asks you to type it back. Pick a category to begin."
        action={<ChooseLessonLink />}
      />
    );
  }

  if (phase === "error") return <ErrorState message={error ?? "Unknown error"} />;
  if (phase === "idle" || phase === "loading") return <LoadingState label="Building your queue…" />;

  if (phase === "finished") {
    return (
      <EmptyState
        title={cards.length === 0 ? "Nothing to study here yet" : "Session complete"}
        description={
          cards.length === 0
            ? `${CATEGORY_INFO[category].label} has no sentences due or available right now.`
            : `You finished ${cards.length} ${cards.length === 1 ? "card" : "cards"} and earned ${sessionXp} XP. Your progress is saved on this device.`
        }
        action={<ChooseLessonLink label="Back to categories" />}
      />
    );
  }

  return <DictationCard />;
}

export function LearnScreen() {
  return (
    <Suspense fallback={<LoadingState label="Building your queue…" />}>
      <LearnSession />
    </Suspense>
  );
}
