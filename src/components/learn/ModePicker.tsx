"use client";

import Link from "next/link";
import type { Category } from "@/lib/models";
import { IMPLEMENTED_MODES, MODE_INFO, type ImplementedMode } from "@/lib/exercises";
import { useT } from "@/components/display/preferences";

export function ModePicker({ category, active }: { category: Category; active: ImplementedMode }) {
  const { language } = useT();
  return (
    <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Exercise mode">
      {IMPLEMENTED_MODES.map((mode) => {
        const selected = mode === active;
        return (
          <Link
            key={mode}
            href={{ pathname: "/learn", query: { category, mode } }}
            aria-current={selected ? "true" : undefined}
            className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${
              selected
                ? "bg-accent text-accent-foreground font-medium"
                : "border-border text-muted hover:text-foreground border"
            }`}
          >
            {language === "th" ? MODE_INFO[mode].labelTh : MODE_INFO[mode].label}
          </Link>
        );
      })}
    </div>
  );
}
