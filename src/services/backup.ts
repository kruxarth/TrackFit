import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { getDatabase } from "../db/database";
import { migrations } from "../db/migrations";
import { useSettingsStore } from "../stores/settingsStore";
import { useWorkoutStore } from "../stores/workoutStore";

const CURRENT_SCHEMA_VERSION = Math.max(...migrations.map((m) => m.version));

function todaySuffix(): string {
  const d = new Date();
  const y = String(d.getFullYear());
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

export type BackupPayload = {
  app: string;
  schema_version: number;
  exported_at: number;
  data: {
    days: unknown[];
    day_exercises: unknown[];
    workout_logs: unknown[];
    logged_exercises: unknown[];
    logged_sets: unknown[];
    body_metrics: unknown[];
    daily_steps: unknown[];
    settings: unknown[];
  };
};

export async function createBackupJson(): Promise<BackupPayload> {
  const db = await getDatabase();
  const days = await db.getAllAsync("SELECT * FROM days");
  const day_exercises = await db.getAllAsync("SELECT * FROM day_exercises");
  const workout_logs = await db.getAllAsync("SELECT * FROM workout_logs");
  const logged_exercises = await db.getAllAsync("SELECT * FROM logged_exercises");
  const logged_sets = await db.getAllAsync("SELECT * FROM logged_sets");
  const body_metrics = await db.getAllAsync("SELECT * FROM body_metrics");
  const daily_steps = await db.getAllAsync("SELECT * FROM daily_steps");
  const settings = await db.getAllAsync("SELECT * FROM settings");

  return {
    app: "trackfit",
    schema_version: CURRENT_SCHEMA_VERSION,
    exported_at: Date.now(),
    data: {
      days,
      day_exercises,
      workout_logs,
      logged_exercises,
      logged_sets,
      body_metrics,
      daily_steps,
      settings,
    },
  };
}

export async function backupAndShare(): Promise<string> {
  const payload = await createBackupJson();
  const json = JSON.stringify(payload, null, 2);
  const fileName = `trackfit-backup-${todaySuffix()}.json`;
  const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? "";
  const uri = dir + fileName;
  await FileSystem.writeAsStringAsync(uri, json, { encoding: FileSystem.EncodingType.UTF8 });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, { mimeType: "application/json" });
  }
  return uri;
}

export async function pickAndRestore(): Promise<{ success: boolean; error?: string }> {
  const result = await DocumentPicker.getDocumentAsync({ type: "application/json", copyToCacheDirectory: true });
  if (result.canceled) return { success: false, error: "Canceled" };
  const asset = result.assets[0];
  if (!asset) return { success: false, error: "No file selected" };
  const content = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
  let parsed: BackupPayload;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { success: false, error: "Invalid JSON file" };
  }
  if (parsed.app !== "trackfit" && parsed.app !== "trackit") return { success: false, error: "Invalid backup: app mismatch" };
  if (typeof parsed.schema_version !== "number" || parsed.schema_version > CURRENT_SCHEMA_VERSION) {
    return { success: false, error: `Unsupported schema version ${parsed.schema_version}` };
  }
  if (!parsed.data || typeof parsed.data !== "object") return { success: false, error: "Invalid backup: missing data" };

  const db = await getDatabase();
  const tables: (keyof BackupPayload["data"])[] = ["days", "day_exercises", "workout_logs", "logged_exercises", "logged_sets", "body_metrics", "daily_steps", "settings"];

  // Validate that data contains arrays for each table (allow missing? but spec says all eight tables)
  for (const t of tables) {
    if (!Array.isArray((parsed.data as Record<string, unknown>)[t])) {
      return { success: false, error: `Invalid backup: missing table ${t}` };
    }
  }

  try {
    await db.withTransactionAsync(async () => {
      // Disable FK temporarily? We will delete in correct order with cascade? Instead delete child first then parent, or just disable FK then re-enable.
      await db.execAsync("PRAGMA foreign_keys = OFF;");
      // Delete all rows
      await db.execAsync("DELETE FROM logged_sets;");
      await db.execAsync("DELETE FROM logged_exercises;");
      await db.execAsync("DELETE FROM workout_logs;");
      await db.execAsync("DELETE FROM day_exercises;");
      await db.execAsync("DELETE FROM days;");
      await db.execAsync("DELETE FROM body_metrics;");
      await db.execAsync("DELETE FROM daily_steps;");
      await db.execAsync("DELETE FROM settings;");

      // Helper to insert rows
      const insertRows = async (table: string, rows: unknown[]) => {
        for (const row of rows as Record<string, unknown>[]) {
          const keys = Object.keys(row);
          if (keys.length === 0) continue;
          const placeholders = keys.map(() => "?").join(", ");
          const values = keys.map((k) => row[k] ?? null);
          const sql = `INSERT INTO ${table} (${keys.join(", ")}) VALUES (${placeholders})`;
          await db.runAsync(sql, values as unknown as (string | number | null)[]);
        }
      };

      await insertRows("days", parsed.data.days as unknown[]);
      await insertRows("day_exercises", parsed.data.day_exercises as unknown[]);
      await insertRows("workout_logs", parsed.data.workout_logs as unknown[]);
      await insertRows("logged_exercises", parsed.data.logged_exercises as unknown[]);
      await insertRows("logged_sets", parsed.data.logged_sets as unknown[]);
      await insertRows("body_metrics", parsed.data.body_metrics as unknown[]);
      await insertRows("daily_steps", parsed.data.daily_steps as unknown[]);
      await insertRows("settings", parsed.data.settings as unknown[]);

      await db.execAsync("PRAGMA foreign_keys = ON;");
    });

    // Reload stores
    await useSettingsStore.getState().hydrate();
    await useWorkoutStore.getState().hydrate();

    return { success: true };
  } catch (e) {
    // Ensure FK on
    try {
      await db.execAsync("PRAGMA foreign_keys = ON;");
    } catch {}
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg };
  }
}
