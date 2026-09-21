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

function Switch({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
        on ? "bg-accent text-accent-foreground" : "border-border text-muted border"
      }`}
    >
      {on ? "On" : "Off"}
    </button>
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

      <Row label="Feedback sounds" hint="A short tone after each answer.">
        <Switch
          label="Feedback sounds"
          on={settings.soundEnabled}
          onToggle={() => void update({ soundEnabled: !settings.soundEnabled })}
        />
      </Row>

      <Row label="Spoken audio" hint="Reads prompts aloud where a voice is installed.">
        <Switch
          label="Spoken audio"
          on={settings.ttsEnabled}
          onToggle={() => void update({ ttsEnabled: !settings.ttsEnabled })}
        />
      </Row>

      <Row label="Speech rate" hint="How fast prompts are read.">
        <input
          type="range"
          min={0.5}
          max={2}
          step={0.1}
          value={settings.ttsRate}
          onChange={(e) => void update({ ttsRate: Number(e.target.value) })}
          aria-label="Speech rate"
          className="w-32"
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

      <Row
        label="AI assistance"
        hint="Optional and off. Every core feature works without it; a provider can be configured in a later release."
      >
        <span className="border-border text-muted rounded-lg border px-3 py-1.5 text-xs">
          {settings.ai.enabled ? `On — ${settings.ai.provider}` : "Not configured"}
        </span>
      </Row>
    </div>
  );
}
