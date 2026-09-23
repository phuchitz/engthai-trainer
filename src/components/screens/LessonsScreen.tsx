"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CATEGORY_INFO, CATEGORIES } from "@/lib/models";
import { loadCategorySummaries, type CategorySummary } from "@/lib/study/stats";
import { useLibrary } from "@/hooks/useLibrary";
import { ErrorState, LoadingState } from "@/components/common/States";
import { useT } from "@/components/display/preferences";

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="bg-surface-muted h-1.5 w-full overflow-hidden rounded-full">
      <div
        className="bg-accent h-full rounded-full transition-[width]"
        style={{ width: `${percent}%` }}
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  );
}

function CategoryCard({ summary }: { summary: CategorySummary }) {
  const info = CATEGORY_INFO[summary.category];
  const empty = summary.total === 0;
  const { t, language } = useT();

  return (
    <li className="border-border bg-surface rounded-xl border p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-medium">{language === "th" ? info.labelTh : info.label}</p>
          <p className="text-muted text-sm" lang={language === "th" ? "en" : "th"}>
            {language === "th" ? info.label : info.labelTh}
          </p>
        </div>
        {summary.levels.length > 0 ? (
          <span className="bg-surface-muted text-muted shrink-0 rounded-md px-2 py-1 text-xs">
            {summary.levels.length === 1
              ? summary.levels[0]
              : `${summary.levels[0]}–${summary.levels[summary.levels.length - 1]}`}
          </span>
        ) : null}
      </div>

      <p className="text-muted mt-2 text-sm">{info.description}</p>

      {empty ? (
        <p className="text-muted mt-4 text-sm">
          {t("lessons.empty")}
        </p>
      ) : (
        <>
          <div className="text-muted mt-4 flex items-center justify-between text-xs">
            <span>
              {t(summary.total === 1 ? "lessons.sentence" : "lessons.sentences", { count: summary.total })}
              {summary.due > 0 ? ` · ${t("lessons.due", { count: summary.due })}` : ""}
            </span>
            <span className="tabular-nums">
              {t("lessons.complete", { percent: summary.completionPercent })}
            </span>
          </div>
          <div className="mt-2">
            <ProgressBar percent={summary.completionPercent} />
          </div>
          <Link
            href={{ pathname: "/learn", query: { category: summary.category } }}
            className="bg-accent text-accent-foreground mt-4 inline-flex rounded-lg px-4 py-2 text-sm font-medium"
          >
            {t("lessons.start")}
          </Link>
        </>
      )}
    </li>
  );
}

export function LessonsScreen() {
  const { status, error } = useLibrary();
  const { t } = useT();
  const [summaries, setSummaries] = useState<CategorySummary[] | null>(null);

  useEffect(() => {
    if (status !== "ready") return;
    void loadCategorySummaries().then(setSummaries);
  }, [status]);

  if (status === "error") return <ErrorState message={error ?? "Unknown error"} />;
  if (status === "idle" || status === "loading" || summaries === null)
    return <LoadingState />;

  const stocked = summaries.filter((s) => s.total > 0);
  const empty = summaries.filter((s) => s.total === 0);

  return (
    <div className="space-y-6">
      <ul className="space-y-3">
        {stocked.map((summary) => (
          <CategoryCard key={summary.category} summary={summary} />
        ))}
      </ul>

      {empty.length > 0 ? (
        <section>
          <h2 className="text-muted mb-3 text-xs font-medium tracking-wide uppercase">
            {t("lessons.notStarted", { count: empty.length, total: CATEGORIES.length })}
          </h2>
          <ul className="space-y-3">
            {empty.map((summary) => (
              <CategoryCard key={summary.category} summary={summary} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
