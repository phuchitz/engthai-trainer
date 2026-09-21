"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { isCategory, CATEGORY_INFO } from "@/lib/models";
import { isImplementedMode, MODE_INFO } from "@/lib/exercises";
import { useStudyStore, sourceKey } from "@/stores/useStudyStore";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/States";
import { ExerciseCard } from "@/components/learn/ExerciseCard";
import { ModePicker } from "@/components/learn/ModePicker";

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
  const rawCategory = params.get("category");
  const rawMode = params.get("mode");

  const category = isCategory(rawCategory) ? rawCategory : null;
  const mode = isImplementedMode(rawMode) ? rawMode : "dictation";

  const { phase, error, cards, sessionXp, source, startLesson } = useStudyStore();

  // Both the category and the mode live in the URL, so a reload resumes the same
  // exercise rather than dropping back to the default.
  useEffect(() => {
    if (!category) return;
    const wanted = sourceKey({ kind: "lesson", category, mode });
    if (!source || sourceKey(source) !== wanted) void startLesson(category, mode);
  }, [category, mode, source, startLesson]);

  if (!category) {
    return (
      <EmptyState
        title="No category selected"
        description="Pick a category, then choose how you want to practise it."
        action={<ChooseLessonLink />}
      />
    );
  }

  const picker = <ModePicker category={category} active={mode} />;

  if (phase === "error") {
    return (
      <>
        {picker}
        <ErrorState message={error ?? "Unknown error"} />
      </>
    );
  }

  if (phase === "idle" || phase === "loading") {
    return (
      <>
        {picker}
        <LoadingState label="Building your queue…" />
      </>
    );
  }

  if (phase === "finished") {
    return (
      <>
        {picker}
        <EmptyState
          title={cards.length === 0 ? "Nothing to study here yet" : "Session complete"}
          description={
            cards.length === 0
              ? `${CATEGORY_INFO[category].label} has nothing due for ${MODE_INFO[mode].label} right now. Another mode may still have cards.`
              : `You finished ${cards.length} ${cards.length === 1 ? "card" : "cards"} and earned ${sessionXp} XP. Your progress is saved on this device.`
          }
          action={<ChooseLessonLink label="Back to categories" />}
        />
      </>
    );
  }

  return (
    <>
      {picker}
      <ExerciseCard />
    </>
  );
}

export function LearnScreen() {
  return (
    <Suspense fallback={<LoadingState label="Building your queue…" />}>
      <LearnSession />
    </Suspense>
  );
}
