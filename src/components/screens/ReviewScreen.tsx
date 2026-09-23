"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { loadReviewCounts, type ReviewCounts, type ReviewKind } from "@/lib/study";
import { useLibrary } from "@/hooks/useLibrary";
import { useStudyStore, sourceKey } from "@/stores/useStudyStore";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/States";
import { useT } from "@/components/display/preferences";
import { ExerciseCard } from "@/components/learn/ExerciseCard";
import { SessionSummary } from "@/components/learn/SessionSummary";

const KINDS: ReviewKind[] = ["due", "mistakes"];

function isReviewKind(value: unknown): value is ReviewKind {
  return value === "due" || value === "mistakes";
}

function QueueCard({ kind, count }: { kind: ReviewKind; count: number }) {
  const { t } = useT();
  const empty = count === 0;
  const labels = {
    title: t(kind === "due" ? "review.due.title" : "review.mistakes.title"),
    description: t(kind === "due" ? "review.due.description" : "review.mistakes.description"),
  };

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
          {t(kind === "due" ? "review.due.empty" : "review.mistakes.empty")}
        </p>
      ) : (
        <Link
          href={{ pathname: "/review", query: { queue: kind } }}
          className="bg-accent text-accent-foreground mt-4 inline-flex rounded-lg px-4 py-2 text-sm font-medium"
        >
          {t("review.start", { queue: labels.title.toLowerCase() })}
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

  const { phase, error, cards, source, startReview } = useStudyStore();
  const { t } = useT();
  const queueTitle = t(queue === "mistakes" ? "review.mistakes.title" : "review.due.title");

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
    if (status !== "ready" || counts === null) return <LoadingState />;
    return (
      <ul className="space-y-3">
        {KINDS.map((kind) => (
          <QueueCard key={kind} kind={kind} count={counts[kind]} />
        ))}
      </ul>
    );
  }

  if (phase === "error") return <ErrorState message={error ?? "Unknown error"} />;
  if (phase === "idle" || phase === "loading") return <LoadingState label={t("learn.building")} />;

  if (phase === "finished") {
    if (cards.length === 0) {
      return (
        <EmptyState
          title={t("review.emptyQueue.title")}
          description={t("review.emptyQueue.description", { queue: queueTitle })}
          action={
            <Link
              href="/review"
              className="bg-accent text-accent-foreground rounded-lg px-4 py-2 text-sm font-medium"
            >
              {t("review.back")}
            </Link>
          }
        />
      );
    }
    return <SessionSummary backHref="/review" backLabel={t("review.back")} />;
  }

  return (
    <>
      <Link href="/review" className="text-muted mb-4 inline-block text-xs underline">
        ← {queueTitle}
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
