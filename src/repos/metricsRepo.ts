import { getDatabase } from "../db/database";

export type BodyMetricRow = {
  id: number;
  date: string;
  weight_kg: number;
  created_at: number;
};

export async function upsertBodyMetric(date: string, weightKg: number): Promise<BodyMetricRow> {
  const db = await getDatabase();
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO body_metrics (date, weight_kg, created_at) VALUES (?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET weight_kg = excluded.weight_kg, created_at = excluded.created_at`,
    [date, weightKg, now]
  );
  const row = await db.getFirstAsync<BodyMetricRow>("SELECT * FROM body_metrics WHERE date = ?", [date]);
  if (!row) throw new Error("Failed to upsert body metric");
  return row;
}

export async function listBodyMetrics(): Promise<BodyMetricRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<BodyMetricRow>("SELECT * FROM body_metrics ORDER BY date ASC");
}

export async function getBodyMetricByDate(date: string): Promise<BodyMetricRow | null> {
  const db = await getDatabase();
  return db.getFirstAsync<BodyMetricRow>("SELECT * FROM body_metrics WHERE date = ?", [date]);
}

export async function getLatestBodyMetric(): Promise<BodyMetricRow | null> {
  const db = await getDatabase();
  return db.getFirstAsync<BodyMetricRow>("SELECT * FROM body_metrics ORDER BY date DESC LIMIT 1");
}

export async function deleteBodyMetric(date: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM body_metrics WHERE date = ?", [date]);
}
