import { getDatabase } from "../db/database";

export type SettingsKey = "unit" | "rest_timer_enabled" | "rest_timer_seconds" | "steps_enabled" | "height_cm" | "theme_preference";

export const defaultSettings: Record<SettingsKey, string | undefined> = {
  unit: "kg",
  rest_timer_enabled: "1",
  rest_timer_seconds: "90",
  steps_enabled: "0",
  height_cm: undefined,
  theme_preference: "system",
};

export async function getSetting(key: SettingsKey): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key = ?", [key]);
  if (row) return row.value;
  const def = defaultSettings[key];
  return def ?? null;
}

export async function setSetting(key: SettingsKey, value: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [key, value]);
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ key: string; value: string }>("SELECT key, value FROM settings");
  const result: Record<string, string> = {};
  for (const k of Object.keys(defaultSettings) as SettingsKey[]) {
    const v = defaultSettings[k];
    if (v !== undefined) result[k] = v;
  }
  for (const r of rows) {
    result[r.key] = r.value;
  }
  // Filter out undefined height if not set
  if (result["height_cm"] === undefined && !rows.find((r) => r.key === "height_cm")) {
    delete result["height_cm"];
  }
  return result;
}

export async function getUnit(): Promise<"kg" | "lbs"> {
  const v = await getSetting("unit");
  return v === "lbs" ? "lbs" : "kg";
}

export async function getRestTimerEnabled(): Promise<boolean> {
  const v = await getSetting("rest_timer_enabled");
  return v !== "0";
}

export async function getRestTimerSeconds(): Promise<number> {
  const v = await getSetting("rest_timer_seconds");
  return v ? parseInt(v, 10) : 90;
}

export async function getStepsEnabled(): Promise<boolean> {
  const v = await getSetting("steps_enabled");
  return v === "1";
}

export async function getHeightCm(): Promise<number | null> {
  const v = await getSetting("height_cm");
  if (!v) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}
