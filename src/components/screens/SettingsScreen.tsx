"use client";

import { useSettings } from "@/hooks/useSettings";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { ErrorState, LoadingState } from "@/components/common/States";
import { AIPanel } from "@/components/settings/AIPanel";
import { ProfilePanel } from "@/components/settings/ProfilePanel";
import { LanguageToggle, TextSizeToggle } from "@/components/display/DisplayControls";
import { useT } from "@/components/display/preferences";

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
  const { t } = useT();

  if (status === "idle" || status === "loading" || !settings)
    return <LoadingState label="Loading settings…" />;
  if (status === "error") return <ErrorState message={error ?? "Unknown error"} />;

  return (
    <div className="space-y-6">
      <ProfilePanel />

      <div className="divide-border border-border bg-surface divide-y overflow-hidden rounded-xl border">
        <Row label={t("settings.language")} hint={t("settings.language.hint")}>
          <LanguageToggle />
        </Row>

        <Row label={t("settings.textSize")} hint={t("settings.textSize.hint")}>
          <TextSizeToggle />
        </Row>

        <Row label={t("settings.theme")} hint={t("settings.theme.hint")}>
          <ThemeToggle />
        </Row>

        <Row label={t("settings.dailyGoal")} hint={t("settings.dailyGoal.hint")}>
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

        <Row label={t("settings.sound")} hint={t("settings.sound.hint")}>
          <Switch
            label="Feedback sounds"
            on={settings.soundEnabled}
            onToggle={() => void update({ soundEnabled: !settings.soundEnabled })}
          />
        </Row>

        <Row label={t("settings.tts")} hint={t("settings.tts.hint")}>
          <Switch
            label="Spoken audio"
            on={settings.ttsEnabled}
            onToggle={() => void update({ ttsEnabled: !settings.ttsEnabled })}
          />
        </Row>

        <Row label={t("settings.rate")} hint={t("settings.rate.hint")}>
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

        <Row label={t("settings.newPerDay")}>
          <span className="text-muted text-sm tabular-nums">{settings.newPerDay}</span>
        </Row>

        <Row label={t("settings.strictness")} hint={t("settings.strictness.hint")}>
          <span className="text-muted text-sm capitalize">{settings.strictness}</span>
        </Row>

      </div>

      <AIPanel settings={settings} onUpdate={(patch) => void update(patch)} />
    </div>
  );
}
