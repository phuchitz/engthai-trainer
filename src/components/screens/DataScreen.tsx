"use client";

import { useState } from "react";
import { useLibrary } from "@/hooks/useLibrary";
import { ErrorState, LoadingState } from "@/components/common/States";
import { StatTile } from "@/components/common/StatTile";
import { ImportPanel } from "@/components/data/ImportPanel";
import { BackupPanel } from "@/components/data/BackupPanel";

const TABS = [
  { id: "import", label: "Import lessons" },
  { id: "backup", label: "Backup & restore" },
] as const;

type Tab = (typeof TABS)[number]["id"];

export function DataScreen() {
  const { status, error, sentenceCount, vocabularyCount, lessons } = useLibrary();
  const [tab, setTab] = useState<Tab>("import");

  if (status === "idle" || status === "loading") return <LoadingState label="Reading your library…" />;
  if (status === "error") return <ErrorState message={error ?? "Unknown error"} />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Lessons" value={lessons.length} />
        <StatTile label="Sentences" value={sentenceCount} />
        <StatTile label="Vocabulary" value={vocabularyCount} />
      </div>

      {/* Adding lessons and replacing everything are different enough that they should
          never sit on the same panel. */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Data tools">
        {TABS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={tab === option.id}
            onClick={() => setTab(option.id)}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              tab === option.id
                ? "bg-accent text-accent-foreground font-medium"
                : "border-border text-muted border"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {tab === "import" ? <ImportPanel /> : <BackupPanel />}
    </div>
  );
}
