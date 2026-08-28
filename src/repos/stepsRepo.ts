import { getDatabase, withBusyRetry } from "../db/database";
import { todayLocalISO } from "../utils/dates";

export type DailyStepsRow = {
  date: string;
  steps: number;
};

export async function upsertAddSteps(date: string, delta: number): Promise<void> {
  await withBusyRetry(async () => {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO daily_steps (date, steps) VALUES (?, ?)
       ON CONFLICT(date) DO UPDATE SET steps = steps + excluded.steps`,
      [date, delta]
    );
  });
}

export async function setDailySteps(date: string, steps: number): Promise<void> {
  await withBusyRetry(async () => {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO daily_steps (date, steps) VALUES (?, ?)
       ON CONFLICT(date) DO UPDATE SET steps = excluded.steps`,
      [date, steps]
    );
  });
}

export async function getDailySteps(date: string): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<DailyStepsRow>("SELECT * FROM daily_steps WHERE date = ?", [date]);
  return row?.steps ?? 0;
}

export async function listDailySteps(): Promise<DailyStepsRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<DailyStepsRow>("SELECT * FROM daily_steps ORDER BY date ASC");
}

export async function getTodaySteps(): Promise<number> {
  return getDailySteps(todayLocalISO());
}

export async function getStepsForLast7Days(): Promise<DailyStepsRow[]> {
  const db = await getDatabase();
  // Get last 7 dates including today
  const rows = await db.getAllAsync<DailyStepsRow>("SELECT * FROM daily_steps ORDER BY date DESC LIMIT 7");
  return rows.reverse();
}
