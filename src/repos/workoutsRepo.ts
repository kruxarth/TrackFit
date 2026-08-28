import { getDatabase } from "../db/database";

export type WorkoutLogRow = {
  id: number;
  day_id: number | null;
  day_name_snapshot: string;
  started_at: number;
  finished_at: number | null;
  status: "active" | "completed";
};

export type LoggedExerciseRow = {
  id: number;
  workout_log_id: number;
  name: string;
  is_bodyweight: number;
  notes: string | null;
  position: number;
};

export type LoggedSetRow = {
  id: number;
  logged_exercise_id: number;
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
  is_confirmed: number;
  completed_at: number | null;
};

export async function createWorkoutLog(dayId: number | null, dayNameSnapshot: string): Promise<WorkoutLogRow> {
  const db = await getDatabase();
  const now = Date.now();
  const res = await db.runAsync(
    "INSERT INTO workout_logs (day_id, day_name_snapshot, started_at, status) VALUES (?, ?, ?, ?)",
    [dayId, dayNameSnapshot, now, "active"]
  );
  const id = res.lastInsertRowId;
  const row = await db.getFirstAsync<WorkoutLogRow>("SELECT * FROM workout_logs WHERE id = ?", [id]);
  if (!row) throw new Error("Failed to create workout log");
  return row;
}

export async function getActiveWorkout(): Promise<WorkoutLogRow | null> {
  const db = await getDatabase();
  return db.getFirstAsync<WorkoutLogRow>("SELECT * FROM workout_logs WHERE status = 'active' ORDER BY started_at DESC LIMIT 1");
}

export async function getWorkoutLogById(id: number): Promise<WorkoutLogRow | null> {
  const db = await getDatabase();
  return db.getFirstAsync<WorkoutLogRow>("SELECT * FROM workout_logs WHERE id = ?", [id]);
}

export async function listCompletedLogs(): Promise<WorkoutLogRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<WorkoutLogRow>("SELECT * FROM workout_logs WHERE status = 'completed' ORDER BY started_at DESC");
}

export async function listAllLogs(): Promise<WorkoutLogRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<WorkoutLogRow>("SELECT * FROM workout_logs ORDER BY started_at DESC");
}

export async function getRecentCompletedLogs(limit = 3): Promise<WorkoutLogRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<WorkoutLogRow>("SELECT * FROM workout_logs WHERE status = 'completed' ORDER BY started_at DESC LIMIT ?", [limit]);
}

export async function finishWorkout(logId: number): Promise<void> {
  const db = await getDatabase();
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    // delete unconfirmed sets
    await db.execAsync(`DELETE FROM logged_sets WHERE logged_exercise_id IN (SELECT id FROM logged_exercises WHERE workout_log_id = ${logId}) AND is_confirmed = 0`);
    // delete exercises that now have zero sets
    await db.execAsync(`DELETE FROM logged_exercises WHERE workout_log_id = ${logId} AND id NOT IN (SELECT logged_exercise_id FROM logged_sets)`);
    await db.runAsync("UPDATE workout_logs SET finished_at = ?, status = 'completed' WHERE id = ?", [now, logId]);
  });
}

export async function discardWorkout(logId: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM workout_logs WHERE id = ?", [logId]);
}

export async function deleteWorkoutLog(logId: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM workout_logs WHERE id = ?", [logId]);
}

// Logged exercises
export async function getLoggedExercises(workoutLogId: number): Promise<LoggedExerciseRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<LoggedExerciseRow>("SELECT * FROM logged_exercises WHERE workout_log_id = ? ORDER BY position ASC, id ASC", [workoutLogId]);
}

export async function createLoggedExercise(
  workoutLogId: number,
  name: string,
  isBodyweight = 0,
  position?: number,
  notes: string | null = null
): Promise<LoggedExerciseRow> {
  const db = await getDatabase();
  let pos = position;
  if (pos === undefined) {
    const rows = await db.getAllAsync<{ maxPos: number | null }>("SELECT MAX(position) as maxPos FROM logged_exercises WHERE workout_log_id = ?", [workoutLogId]);
    const maxPos = rows[0]?.maxPos ?? -1;
    pos = maxPos + 1;
  }
  const res = await db.runAsync(
    "INSERT INTO logged_exercises (workout_log_id, name, is_bodyweight, notes, position) VALUES (?, ?, ?, ?, ?)",
    [workoutLogId, name.trim(), isBodyweight ? 1 : 0, notes, pos]
  );
  const id = res.lastInsertRowId;
  const row = await db.getFirstAsync<LoggedExerciseRow>("SELECT * FROM logged_exercises WHERE id = ?", [id]);
  if (!row) throw new Error("Failed to create logged exercise");
  return row;
}

export async function updateLoggedExerciseNotes(id: number, notes: string | null): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("UPDATE logged_exercises SET notes = ? WHERE id = ?", [notes, id]);
}

export async function updateLoggedExerciseName(id: number, name: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("UPDATE logged_exercises SET name = ? WHERE id = ?", [name.trim(), id]);
}

export async function updateLoggedExerciseBodyweight(id: number, isBodyweight: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("UPDATE logged_exercises SET is_bodyweight = ? WHERE id = ?", [isBodyweight ? 1 : 0, id]);
}

export async function deleteLoggedExercise(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM logged_exercises WHERE id = ?", [id]);
}

// Logged sets
export async function getLoggedSets(loggedExerciseId: number): Promise<LoggedSetRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<LoggedSetRow>("SELECT * FROM logged_sets WHERE logged_exercise_id = ? ORDER BY set_number ASC, id ASC", [loggedExerciseId]);
}

export async function createLoggedSet(
  loggedExerciseId: number,
  setNumber: number,
  weightKg: number | null,
  reps: number | null,
  isConfirmed = 0
): Promise<LoggedSetRow> {
  const db = await getDatabase();
  const res = await db.runAsync(
    "INSERT INTO logged_sets (logged_exercise_id, set_number, weight_kg, reps, is_confirmed) VALUES (?, ?, ?, ?, ?)",
    [loggedExerciseId, setNumber, weightKg, reps, isConfirmed ? 1 : 0]
  );
  const id = res.lastInsertRowId;
  const row = await db.getFirstAsync<LoggedSetRow>("SELECT * FROM logged_sets WHERE id = ?", [id]);
  if (!row) throw new Error("Failed to create set");
  return row;
}

export async function updateLoggedSet(
  id: number,
  fields: Partial<{ weight_kg: number | null; reps: number | null; is_confirmed: number; completed_at: number | null; set_number: number }>
): Promise<void> {
  const db = await getDatabase();
  const sets: string[] = [];
  const vals: (string | number | null)[] = [];
  if ("weight_kg" in fields) {
    sets.push("weight_kg = ?");
    vals.push(fields.weight_kg ?? null);
  }
  if ("reps" in fields) {
    sets.push("reps = ?");
    vals.push(fields.reps ?? null);
  }
  if ("is_confirmed" in fields) {
    sets.push("is_confirmed = ?");
    vals.push(fields.is_confirmed ? 1 : 0);
  }
  if ("completed_at" in fields) {
    sets.push("completed_at = ?");
    vals.push(fields.completed_at ?? null);
  }
  if ("set_number" in fields) {
    sets.push("set_number = ?");
    vals.push(fields.set_number ?? null);
  }
  if (sets.length === 0) return;
  vals.push(id);
  await db.runAsync(`UPDATE logged_sets SET ${sets.join(", ")} WHERE id = ?`, vals as unknown as (string | number | null)[]);
}

export async function deleteLoggedSet(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM logged_sets WHERE id = ?", [id]);
}

export async function confirmSet(id: number, confirm: boolean): Promise<void> {
  const db = await getDatabase();
  if (confirm) {
    await db.runAsync("UPDATE logged_sets SET is_confirmed = 1, completed_at = ? WHERE id = ?", [Date.now(), id]);
  } else {
    await db.runAsync("UPDATE logged_sets SET is_confirmed = 0, completed_at = NULL WHERE id = ?", [id]);
  }
}

// Carry-forward: find most recent completed log containing exercise name case/trim-insensitive, ordered by started_at DESC, and return its confirmed sets
export async function findLastConfirmedSetsForExercise(name: string): Promise<LoggedSetRow[]> {
  const db = await getDatabase();
  const norm = name.trim().toLowerCase();
  // Find the most recent logged_exercise matching name in a completed log
  const exercise = await db.getFirstAsync<LoggedExerciseRow & { started_at: number }>(
    `SELECT le.*, wl.started_at FROM logged_exercises le
     JOIN workout_logs wl ON le.workout_log_id = wl.id
     WHERE wl.status = 'completed' AND LOWER(TRIM(le.name)) = ?
     ORDER BY wl.started_at DESC LIMIT 1`,
    [norm]
  );
  if (!exercise) return [];
  const sets = await db.getAllAsync<LoggedSetRow>(
    "SELECT * FROM logged_sets WHERE logged_exercise_id = ? AND is_confirmed = 1 ORDER BY set_number ASC",
    [exercise.id]
  );
  return sets;
}

// For B1: alternative that returns sets directly
export async function getCarryForwardSetsForExercise(name: string): Promise<{ weight_kg: number | null; reps: number | null }[]> {
  const sets = await findLastConfirmedSetsForExercise(name);
  return sets.map((s) => ({ weight_kg: s.weight_kg, reps: s.reps }));
}

// Progress queries B6
export async function listDistinctExerciseNames(): Promise<string[]> {
  const db = await getDatabase();
  // select all names, de-duplicate by LOWER(TRIM(name)), display most recent casing
  const rows = await db.getAllAsync<{ name: string; started_at: number }>(
    `SELECT le.name as name, wl.started_at as started_at
     FROM logged_exercises le
     JOIN workout_logs wl ON le.workout_log_id = wl.id
     WHERE wl.status = 'completed'
     ORDER BY wl.started_at DESC`
  );
  const seen = new Map<string, string>();
  for (const r of rows) {
    const key = r.name.trim().toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, r.name);
    }
  }
  return Array.from(seen.values());
}

export type ProgressPoint = {
  started_at: number;
  maxWeightKg: number;
};

export async function getProgressSeries(exerciseName: string, sinceMs?: number): Promise<ProgressPoint[]> {
  const db = await getDatabase();
  const norm = exerciseName.trim().toLowerCase();
  let sql = `
    SELECT wl.started_at as started_at, MAX(ls.weight_kg) as maxWeightKg
    FROM logged_exercises le
    JOIN workout_logs wl ON le.workout_log_id = wl.id
    JOIN logged_sets ls ON ls.logged_exercise_id = le.id
    WHERE wl.status = 'completed'
      AND LOWER(TRIM(le.name)) = ?
      AND ls.is_confirmed = 1
      AND ls.weight_kg IS NOT NULL
  `;
  const params: (string | number)[] = [norm];
  if (sinceMs !== undefined) {
    sql += " AND wl.started_at >= ?";
    params.push(sinceMs);
  }
  sql += " GROUP BY wl.id, wl.started_at HAVING maxWeightKg IS NOT NULL ORDER BY wl.started_at ASC";
  const rows = await db.getAllAsync<{ started_at: number; maxWeightKg: number }>(sql, params as unknown as (string | number)[]);
  return rows.map((r) => ({ started_at: r.started_at, maxWeightKg: r.maxWeightKg }));
}

// Helper for HistoryScreen: get total confirmed sets count for a log
export async function getConfirmedSetsCount(workoutLogId: number): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM logged_sets ls
     JOIN logged_exercises le ON ls.logged_exercise_id = le.id
     WHERE le.workout_log_id = ? AND ls.is_confirmed = 1`,
    [workoutLogId]
  );
  return row?.cnt ?? 0;
}

export async function getExerciseCountForLog(workoutLogId: number): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ cnt: number }>("SELECT COUNT(*) as cnt FROM logged_exercises WHERE workout_log_id = ?", [workoutLogId]);
  return row?.cnt ?? 0;
}
