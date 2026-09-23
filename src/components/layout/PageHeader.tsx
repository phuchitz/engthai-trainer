"use client";

import { useT } from "@/components/display/preferences";
import { STRINGS, type StringKey } from "@/lib/i18n";

/**
 * A page heading, always bilingual.
 *
 * The app has shown the title in both languages since the first screen, and that is
 * worth keeping whichever way round the interface is set: a learner reading Thai still
 * benefits from seeing the English, and vice versa. So the current language leads and
 * the other follows underneath, rather than Thai always being the subtitle.
 */
export function PageHeader({
  titleKey,
  descriptionKey,
}: {
  titleKey: StringKey;
  descriptionKey?: StringKey;
}) {
  const { t, language } = useT();
  const other = language === "en" ? "th" : "en";

  return (
    <header className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t(titleKey)}</h1>
      <p className="text-muted text-sm" lang={other}>
        {STRINGS[titleKey][other]}
      </p>
      {descriptionKey ? <p className="text-muted mt-2 text-sm">{t(descriptionKey)}</p> : null}
    </header>
  );
}
