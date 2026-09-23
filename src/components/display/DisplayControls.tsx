"use client";

import { LANGUAGES, type UiLanguage } from "@/lib/i18n";
import { TEXT_SIZES, useT, useTextSize, useUiLanguage, type TextSize } from "./preferences";

/** A small segmented control. The same shape the theme toggle already uses. */
function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; className?: string }[];
  onChange: (next: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="border-border flex rounded-lg border p-0.5">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
              selected ? "bg-accent text-accent-foreground font-medium" : "text-muted"
            } ${option.className ?? ""}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

const LANGUAGE_LABELS: Record<UiLanguage, string> = { en: "English", th: "ไทย" };

export function LanguageToggle() {
  const { language, setLanguage } = useUiLanguage();
  const { t } = useT();

  return (
    <Segmented
      label={t("settings.language")}
      value={language}
      onChange={setLanguage}
      options={LANGUAGES.map((value) => ({
        value,
        // Each option is written in its own language: someone who cannot read the
        // current one still has to be able to find their way back.
        label: LANGUAGE_LABELS[value],
        className: value === "th" ? "font-[var(--font-thai)]" : undefined,
      }))}
    />
  );
}

const SIZE_KEYS = {
  s: "textSize.s",
  m: "textSize.m",
  l: "textSize.l",
  xl: "textSize.xl",
} as const;

export function TextSizeToggle() {
  const { size, setSize } = useTextSize();
  const { t } = useT();

  return (
    <Segmented
      label={t("textSize.label")}
      value={size}
      onChange={setSize}
      options={TEXT_SIZES.map((value) => ({
        value: value as TextSize,
        label: t(SIZE_KEYS[value]),
      }))}
    />
  );
}
