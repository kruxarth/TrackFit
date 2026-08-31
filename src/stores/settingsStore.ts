import { create } from "zustand";
import * as settingsRepo from "../repos/settingsRepo";
import type { Unit } from "../utils/units";

export type ThemePreference = "system" | "light" | "dark";

function parseThemePreference(value: string | null): ThemePreference {
  if (value === "light" || value === "dark" || value === "system") return value;
  return "system";
}

type SettingsState = {
  unit: Unit;
  restTimerEnabled: boolean;
  restTimerSeconds: number;
  heightCm: number | null;
  themePreference: ThemePreference;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setUnit: (unit: Unit) => Promise<void>;
  setRestTimerEnabled: (enabled: boolean) => Promise<void>;
  setRestTimerSeconds: (seconds: number) => Promise<void>;
  setHeightCm: (heightCm: number | null) => Promise<void>;
  setThemePreference: (preference: ThemePreference) => Promise<void>;
};

export const useSettingsStore = create<SettingsState>((set) => ({
  unit: "kg",
  restTimerEnabled: true,
  restTimerSeconds: 90,
  heightCm: null,
  themePreference: "system",
  hydrated: false,

  hydrate: async () => {
    const unitStr = await settingsRepo.getSetting("unit");
    const restEnabledStr = await settingsRepo.getSetting("rest_timer_enabled");
    const restSecondsStr = await settingsRepo.getSetting("rest_timer_seconds");
    const heightStr = await settingsRepo.getSetting("height_cm");
    const themeStr = await settingsRepo.getSetting("theme_preference");

    const unit: Unit = unitStr === "lbs" ? "lbs" : "kg";
    const restTimerEnabled = restEnabledStr !== "0";
    const restTimerSeconds = restSecondsStr ? parseInt(restSecondsStr, 10) : 90;
    const heightCm = heightStr ? Number(heightStr) : null;
    const validHeight = heightCm !== null && !Number.isNaN(heightCm) ? heightCm : null;

    set({
      unit,
      restTimerEnabled,
      restTimerSeconds: Number.isNaN(restTimerSeconds) ? 90 : restTimerSeconds,
      heightCm: validHeight,
      themePreference: parseThemePreference(themeStr),
      hydrated: true,
    });
  },

  setUnit: async (unit: Unit) => {
    await settingsRepo.setSetting("unit", unit);
    set({ unit });
  },

  setRestTimerEnabled: async (enabled: boolean) => {
    await settingsRepo.setSetting("rest_timer_enabled", enabled ? "1" : "0");
    set({ restTimerEnabled: enabled });
  },

  setRestTimerSeconds: async (seconds: number) => {
    const clamped = Math.max(15, Math.min(600, Math.round(seconds / 15) * 15));
    await settingsRepo.setSetting("rest_timer_seconds", String(clamped));
    set({ restTimerSeconds: clamped });
  },

  setHeightCm: async (heightCm: number | null) => {
    if (heightCm === null || Number.isNaN(heightCm)) {
      const { getDatabase } = await import("../db/database");
      const db = await getDatabase();
      await db.runAsync("DELETE FROM settings WHERE key = ?", ["height_cm"]);
      set({ heightCm: null });
    } else {
      await settingsRepo.setSetting("height_cm", String(heightCm));
      set({ heightCm });
    }
  },

  setThemePreference: async (preference: ThemePreference) => {
    await settingsRepo.setSetting("theme_preference", preference);
    set({ themePreference: preference });
  },
}));
