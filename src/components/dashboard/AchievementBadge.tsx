import type { Achievement, AchievementStats } from "@/lib/gamification";
import { ProgressBar } from "@/components/common/ProgressBar";

export function AchievementBadge({
  achievement,
  stats,
  unlocked,
}: {
  achievement: Achievement;
  stats: AchievementStats;
  unlocked: boolean;
}) {
  const percent = Math.round(achievement.progress(stats) * 100);

  return (
    <li
      className={`border-border rounded-xl border p-3 ${unlocked ? "bg-surface" : "bg-surface/50"}`}
      aria-label={`${achievement.label}: ${unlocked ? "unlocked" : `${percent}% complete`}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`text-sm font-medium ${unlocked ? "" : "text-muted"}`}>{achievement.label}</p>
          <p className="text-muted text-xs" lang="th">
            {achievement.labelTh}
          </p>
        </div>
        <span aria-hidden className={unlocked ? "text-accent" : "text-muted opacity-40"}>
          {unlocked ? "★" : "☆"}
        </span>
      </div>

      <p className="text-muted mt-2 text-xs">{achievement.description}</p>

      {!unlocked ? (
        <div className="mt-2">
          <ProgressBar percent={percent} label={`${achievement.label} progress`} tone="muted" />
        </div>
      ) : null}
    </li>
  );
}
