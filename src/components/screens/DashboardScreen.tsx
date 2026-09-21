"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDuration } from "@/lib/gamification";
import { loadDashboard, type DashboardData } from "@/lib/study";
import { useLibrary } from "@/hooks/useLibrary";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/States";
import { StatTile } from "@/components/common/StatTile";
import { ProgressBar } from "@/components/common/ProgressBar";
import { AchievementBadge } from "@/components/dashboard/AchievementBadge";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-muted mb-3 text-xs font-medium tracking-wide uppercase">{title}</h2>
      {children}
    </section>
  );
}

export function DashboardScreen() {
  const { status, error, sentenceCount } = useLibrary();
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    if (status !== "ready") return;
    void loadDashboard().then(setData);
  }, [status]);

  if (status === "error") return <ErrorState message={error ?? "Unknown error"} />;
  if (status !== "ready" || data === null) return <LoadingState label="Opening your local library…" />;

  if (sentenceCount === 0) {
    return (
      <EmptyState
        title="Nothing to study yet"
        description="Your library is empty. Import a deck or load the starter lessons to get going."
        action={
          <Link
            href="/data"
            className="bg-accent text-accent-foreground rounded-lg px-4 py-2 text-sm font-medium"
          >
            Go to Import / Export
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-8">
      <section className="border-border bg-surface rounded-xl border p-5">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="text-muted text-xs tracking-wide uppercase">Today&rsquo;s goal</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {data.sentencesToday}
              <span className="text-muted text-base font-normal"> / {data.dailyGoal} sentences</span>
            </p>
          </div>
          <p className="text-muted text-sm tabular-nums">{data.goalPercent}%</p>
        </div>
        <div className="mt-3">
          <ProgressBar
            percent={data.goalPercent}
            label="Daily goal"
            tone={data.goalPercent >= 100 ? "success" : "accent"}
          />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/lessons"
            className="bg-accent text-accent-foreground rounded-lg px-4 py-2 text-sm font-medium"
          >
            Start learning
          </Link>
          <Link
            href={{ pathname: "/review", query: { queue: "mistakes" } }}
            className="border-border rounded-lg border px-4 py-2 text-sm font-medium"
          >
            Review mistakes
            {data.mistakeCount > 0 ? (
              <span className="text-muted ml-2 tabular-nums">{data.mistakeCount}</span>
            ) : null}
          </Link>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label="Due reviews" value={data.dueCount} hint="across both directions" />
        <StatTile label="Streak" value={`🔥 ${data.currentStreak}`} hint={`best ${data.longestStreak}`} />
        <StatTile label="XP today" value={data.xpToday} hint={`${data.xpTotal} all time`} />
        <StatTile
          label="Accuracy today"
          value={data.accuracyToday.graded === 0 ? "—" : `${data.accuracyToday.percent}%`}
          hint={`${data.accuracyToday.passed}/${data.accuracyToday.graded} answers`}
        />
        <StatTile
          label="Active time"
          value={formatDuration(data.activeMsToday)}
          hint="idle and background excluded"
        />
        <StatTile
          label="Accuracy all time"
          value={data.accuracyAllTime.graded === 0 ? "—" : `${data.accuracyAllTime.percent}%`}
          hint={`${data.accuracyAllTime.graded} answers`}
        />
      </div>

      {data.recent.length > 0 ? (
        <Section title="Recent lessons">
          <ul className="space-y-2">
            {data.recent.map((entry) => (
              <li
                key={entry.category}
                className="border-border bg-surface flex items-center justify-between gap-4 rounded-xl border p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{entry.label}</p>
                  <p className="text-muted text-xs" lang="th">
                    {entry.labelTh}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-muted text-xs tabular-nums">
                    {entry.attempts} {entry.attempts === 1 ? "answer" : "answers"}
                  </span>
                  <Link
                    href={{ pathname: "/learn", query: { category: entry.category, mode: "translate" } }}
                    className="border-border rounded-lg border px-3 py-1.5 text-xs"
                  >
                    Continue
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title={`Achievements (${data.unlocked.length}/${data.unlocked.length + data.locked.length})`}>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[...data.unlocked, ...data.locked].map((achievement) => (
            <AchievementBadge
              key={achievement.id}
              achievement={achievement}
              stats={data.stats}
              unlocked={data.unlocked.some((a) => a.id === achievement.id)}
            />
          ))}
        </ul>
      </Section>

      {!data.hasHistory ? (
        <p className="text-muted text-sm">
          These figures fill in as you study. Every one is recomputed from your answer history rather than
          stored, so nothing can drift.
        </p>
      ) : null}
    </div>
  );
}
