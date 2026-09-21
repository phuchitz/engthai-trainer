"use client";

import Link from "next/link";
import type { Route } from "next";
import { formatDuration } from "@/lib/gamification";
import { useStudyStore } from "@/stores/useStudyStore";
import { StatTile } from "@/components/common/StatTile";
import { ProgressBar } from "@/components/common/ProgressBar";

export function SessionSummary({ backHref, backLabel }: { backHref: Route; backLabel: string }) {
  const { summary, cardsToday, dailyGoal } = useStudyStore();

  if (!summary) return null;

  const goalPercent = dailyGoal === 0 ? 0 : Math.min(100, Math.round((cardsToday / dailyGoal) * 100));

  return (
    <div className="space-y-6">
      <div className="border-border bg-surface rounded-xl border p-5 text-center">
        <p className="animate-grade-pop text-2xl font-semibold">Session complete</p>
        <p className="text-muted mt-1 text-sm">
          {summary.answered} answered
          {summary.skipped > 0 ? `, ${summary.skipped} skipped` : ""}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Correct" value={`${summary.passed}/${summary.answered}`} />
        <StatTile label="Accuracy" value={summary.answered === 0 ? "—" : `${summary.accuracyPercent}%`} />
        <StatTile label="XP earned" value={summary.xp} />
        <StatTile label="Active time" value={formatDuration(summary.activeMs)} hint="idle excluded" />
      </div>

      <div className="border-border bg-surface rounded-xl border p-4">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <p className="text-sm font-medium">Daily goal</p>
          <p className="text-muted text-sm tabular-nums">
            {cardsToday}/{dailyGoal}
          </p>
        </div>
        <ProgressBar
          percent={goalPercent}
          label="Daily goal"
          tone={goalPercent >= 100 ? "success" : "accent"}
        />
      </div>

      {summary.unlocked.length > 0 ? (
        <div className="border-accent/40 bg-surface rounded-xl border p-4">
          <p className="text-muted text-xs tracking-wide uppercase">
            {summary.unlocked.length === 1 ? "Achievement unlocked" : "Achievements unlocked"}
          </p>
          <ul className="mt-2 space-y-1">
            {summary.unlocked.map((achievement) => (
              <li key={achievement.id} className="flex items-baseline gap-2 text-sm">
                <span className="text-accent" aria-hidden>
                  ★
                </span>
                <span className="font-medium">{achievement.label}</span>
                <span className="text-muted text-xs" lang="th">
                  {achievement.labelTh}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Link
          href={backHref}
          className="bg-accent text-accent-foreground rounded-lg px-4 py-2 text-sm font-medium"
        >
          {backLabel}
        </Link>
        <Link href="/" className="border-border rounded-lg border px-4 py-2 text-sm">
          Dashboard
        </Link>
      </div>
    </div>
  );
}
