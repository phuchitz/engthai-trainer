"use client";

import { useEffect } from "react";
import { useSettingsStore } from "@/stores/useSettingsStore";

export function useSettings() {
  const load = useSettingsStore((s) => s.load);

  useEffect(() => {
    void load();
  }, [load]);

  return useSettingsStore();
}
