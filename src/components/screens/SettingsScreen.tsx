"use client";

import { useSettings } from "@/hooks/useSettings";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { ErrorState, LoadingState } from "@/components/common/States";

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 p-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint ? <p className="text-muted text-xs">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

export function SettingsScreen() {
  const { status, error, settings, update } = useSettings();

  if (status === "idle" || status === "loading" || !settings)
    return <LoadingState label="Loading settings…" />;
  if (status === "error") return <ErrorState message={error ?? "Unknown error"} />;

  return (
    <div className="divide-border border-border bg-surface divide-y overflow-hidden rounded-xl border">
      <Row label="Theme" hint="Stored in this browser, not in your library.">
        <ThemeToggle />
      </Row>

      <Row label="Daily goal" hint="Cards to finish each day.">
        <input
          type="number"
          min={1}
          max={500}
          value={settings.dailyGoal}
          onChange={(e) => {
            const next = Number(e.target.value);
            if (Number.isFinite(next) && next >= 1 && next <= 500) void update({ dailyGoal: next });
          }}
          className="border-border bg-background w-24 rounded-lg border px-3 py-1.5 text-right text-sm tabular-nums"
          aria-label="Daily goal"
        />
      </Row>

      <Row label="New cards per day">
        <span className="text-muted text-sm tabular-nums">{settings.newPerDay}</span>
      </Row>

      <Row label="Answer strictness" hint="Applies to English only. Typed Thai is always checked strictly.">
        <span className="text-muted text-sm capitalize">{settings.strictness}</span>
      </Row>

      <Row label="Interface language">
        <span className="text-muted text-sm uppercase">{settings.uiLanguage}</span>
      </Row>

      <Row label="AI assistance" hint="Every core feature works with this off.">
        <span className="text-muted text-sm">{settings.ai.enabled ? "On" : "Off"}</span>
      </Row>
    </div>
  );
}
