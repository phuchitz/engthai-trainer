"use client";

import { create } from "zustand";
import type { Settings } from "@/lib/models";
import { loadSettings, saveSettings } from "@/lib/db/repositories/settings";
import type { LoadStatus } from "./useLibraryStore";

type SettingsState = {
  status: LoadStatus;
  error: string | null;
  settings: Settings | null;
  load: () => Promise<void>;
  update: (patch: Partial<Omit<Settings, "id" | "createdAt">>) => Promise<void>;
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  status: "idle",
  error: null,
  settings: null,

  load: async () => {
    if (get().status === "loading" || get().status === "ready") return;
    set({ status: "loading", error: null });
    try {
      set({ settings: await loadSettings(), status: "ready" });
    } catch (error) {
      set({ status: "error", error: error instanceof Error ? error.message : String(error) });
    }
  },

  update: async (patch) => {
    try {
      set({ settings: await saveSettings(patch), error: null });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
  },
}));
