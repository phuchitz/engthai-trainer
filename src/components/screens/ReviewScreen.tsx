"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { loadReviewCounts, REVIEW_LABELS, type ReviewCounts, type ReviewKind } from "@/lib/study";
import { useLibrary } from "@/hooks/useLibrary";
import { useStudyStore, sourceKey } from "@/stores/useStudyStore";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/States";
import { ExerciseCard } from "@/components/learn/ExerciseCard";

const KINDS: ReviewKind[] = ["due", "mistakes"];

function isReviewKind(value: unknown): value is ReviewKind {
  return value === "due" || value === "mistakes";
}

function QueueCard({ kind, count }: { kind: ReviewKind; count: number }) {
  const labels = REVIEW_LABELS[kind];
  const empty = count === 0;

  return (
    <li className="border-border bg-surface rounded-xl border p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium">{labels.title}</p>
          <p className="text-muted mt-1 text-sm">{labels.description}</p>
        </div>
        <span className="text-2xl font-semibold tabular-nums">{count}</span>
      </div>
      {empty ? (
        <p className="text-muted mt-4 text-sm">
          {kind === "due"
            ? "Nothing is due right now. Study a lesson to put cards into the schedule."
            : "No mistakes to drill — nothing has been answered wrong yet."}
        </p>
      ) : (
        <Link
          href={{ pathname: "/review", query: { queue: kind } }}
          className="bg-accent text-accent-foreground mt-4 inline-flex rounded-lg px-4 py-2 text-sm font-medium"
        >
          Start {labels.title.toLowerCase()}
        </Link>
      )}
    </li>
  );
}

function ReviewSession() {
  const params = useSearchParams();
  const raw = params.get("queue");
  const queue = isReviewKind(raw) ? raw : null;

  const { status, error: libraryError } = useLibrary();
  const [counts, setCounts] = useState<ReviewCounts | null>(null);

  const { phase, error, cards, sessionXp, source, startReview } = useStudyStore();

  useEffect(() => {
    if (status !== "ready" || queue !== null) return;
    void loadReviewCounts().then(setCounts);
  }, [status, queue]);

  // The queue lives in the URL, so a reload resumes the same drill.
  useEffect(() => {
    if (!queue) return;
    const wanted = sourceKey({ kind: "review", review: queue });
    if (!source || sourceKey(source) !== wanted) void startReview(queue);
  }, [queue, source, startReview]);

  if (status === "error") return <ErrorState message={libraryError ?? "Unknown error"} />;

  if (!queue) {
    if (status !== "ready" || counts === null) return <LoadingState label="Counting what is due…" />;
    return (
      <ul className="space-y-3">
        {KINDS.map((kind) => (
          <QueueCard key={kind} kind={kind} count={counts[kind]} />
        ))}
      </ul>
    );
  }

  if (phase === "error") return <ErrorState message={error ?? "Unknown error"} />;
  if (phase === "idle" || phase === "loading") return <LoadingState label="Building your queue…" />;

  if (phase === "finished") {
    return (
      <EmptyState
        title={cards.length === 0 ? "Nothing in this queue" : "Review complete"}
        description={
          cards.length === 0
            ? `${REVIEW_LABELS[queue].title} is empty right now.`
            : `You finished ${cards.length} ${cards.length === 1 ? "card" : "cards"} and earned ${sessionXp} XP.`
        }
        action={
          <Link
            href="/review"
            className="bg-accent text-accent-foreground rounded-lg px-4 py-2 text-sm font-medium"
          >
            Back to review
          </Link>
        }
      />
    );
  }

  return (
    <>
      <Link href="/review" className="text-muted mb-4 inline-block text-xs underline">
        ← {REVIEW_LABELS[queue].title}
      </Link>
      <ExerciseCard />
    </>
  );
}

export function ReviewScreen() {
  return (
    <Suspense fallback={<LoadingState label="Counting what is due…" />}>
      <ReviewSession />
    </Suspense>
  );
}
