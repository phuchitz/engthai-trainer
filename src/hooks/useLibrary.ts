"use client";

import { useEffect } from "react";
import { useLibraryStore } from "@/stores/useLibraryStore";

/**
 * Opens the database from an effect, never during render, so the statically
 * prerendered HTML matches the first client render and hydration stays clean.
 */
export function useLibrary() {
  const initialize = useLibraryStore((s) => s.initialize);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  return useLibraryStore();
}
