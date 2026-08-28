import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { getDatabase } from "../db/database";
import { buildCsv } from "../utils/csv";
import { toLocalISO } from "../utils/dates";

function todaySuffix(): string {
  const d = new Date();
  const y = String(d.getFullYear());
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

export async function exportWorkoutsCsv(): Promise<string> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    started_at: number;
    workout_id: number;
    day_name: string;
    exercise: string;
    set_number: number;
    weight_kg: number | null;
    reps: number | null;
    is_bodyweight: number;
    exercise_notes: string | null;
  }>(
    `SELECT wl.started_at as started_at,
            wl.id as workout_id,
            wl.day_name_snapshot as day_name,
            le.name as exercise,
            ls.set_number as set_number,
            ls.weight_kg as weight_kg,
            ls.reps as reps,
            le.is_bodyweight as is_bodyweight,
            le.notes as exercise_notes
     FROM workout_logs wl
     JOIN logged_exercises le ON le.workout_log_id = wl.id
     JOIN logged_sets ls ON ls.logged_exercise_id = le.id
     WHERE wl.status = 'completed' AND ls.is_confirmed = 1
     ORDER BY wl.started_at ASC, wl.id ASC, le.position ASC, ls.set_number ASC`
  );

  const header = ["date", "workout_id", "day_name", "exercise", "set_number", "weight_kg", "reps", "is_bodyweight", "exercise_notes"];
  const csvRows = rows.map((r) => [
    toLocalISO(r.started_at),
    String(r.workout_id),
    r.day_name,
    r.exercise,
    String(r.set_number),
    r.weight_kg !== null && r.weight_kg !== undefined ? String(r.weight_kg) : "",
    r.reps !== null && r.reps !== undefined ? String(r.reps) : "",
    String(r.is_bodyweight),
    r.exercise_notes ?? "",
  ]);

  const csv = buildCsv(header, csvRows);
  const fileName = `trackfit-workouts-${todaySuffix()}.csv`;
  const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? "";
  const uri = dir + fileName;
  await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
  return uri;
}

export async function exportBodyCsv(): Promise<string> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ date: string; weight_kg: number }>("SELECT date, weight_kg FROM body_metrics ORDER BY date ASC");
  const header = ["date", "weight_kg"];
  const csvRows = rows.map((r) => [r.date, String(r.weight_kg)]);
  const csv = buildCsv(header, csvRows);
  const fileName = `trackfit-body-${todaySuffix()}.csv`;
  const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? "";
  const uri = dir + fileName;
  await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
  return uri;
}

export async function exportStepsCsv(): Promise<string> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ date: string; steps: number }>("SELECT date, steps FROM daily_steps ORDER BY date ASC");
  const header = ["date", "steps"];
  const csvRows = rows.map((r) => [r.date, String(r.steps)]);
  const csv = buildCsv(header, csvRows);
  const fileName = `trackfit-steps-${todaySuffix()}.csv`;
  const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? "";
  const uri = dir + fileName;
  await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
  return uri;
}

export async function exportAndShareAll(): Promise<void> {
  const workoutsUri = await exportWorkoutsCsv();
  const bodyUri = await exportBodyCsv();
  const stepsUri = await exportStepsCsv();

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) return;
  // Share sequentially
  await Sharing.shareAsync(workoutsUri, { mimeType: "text/csv" });
  await Sharing.shareAsync(bodyUri, { mimeType: "text/csv" });
  await Sharing.shareAsync(stepsUri, { mimeType: "text/csv" });
}
