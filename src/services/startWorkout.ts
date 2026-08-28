import { getDatabase } from "../db/database";
import type { DayExerciseRow } from "../repos/daysRepo";

export async function startWorkout(dayId: number): Promise<number> {
  const db = await getDatabase();

  // Check active log exists
  const active = await db.getFirstAsync<{ id: number }>("SELECT id FROM workout_logs WHERE status = 'active' LIMIT 1");
  if (active) {
    throw new Error("An active workout already exists");
  }

  // Fetch day and its exercises outside transaction for simplicity, but we will verify inside transaction as well
  const day = await db.getFirstAsync<{ id: number; name: string }>("SELECT id, name FROM days WHERE id = ?", [dayId]);
  if (!day) throw new Error("Day not found");

  const dayExercises = await db.getAllAsync<DayExerciseRow>("SELECT * FROM day_exercises WHERE day_id = ? ORDER BY position ASC, id ASC", [dayId]);

  let newLogId = -1;

  await db.withTransactionAsync(async () => {
    const now = Date.now();
    const res = await db.runAsync("INSERT INTO workout_logs (day_id, day_name_snapshot, started_at, status) VALUES (?, ?, ?, ?)", [
      day.id,
      day.name,
      now,
      "active",
    ]);
    newLogId = res.lastInsertRowId;

    for (const ex of dayExercises) {
      const loggedExRes = await db.runAsync(
        "INSERT INTO logged_exercises (workout_log_id, name, is_bodyweight, position) VALUES (?, ?, ?, ?)",
        [newLogId, ex.name, ex.is_bodyweight ? 1 : 0, ex.position]
      );
      const loggedExId = loggedExRes.lastInsertRowId;

      // Carry-forward per exercise: find most recent completed log containing same name (LOWER(TRIM) equality)
      const prevExercise = await db.getFirstAsync<{ id: number }>(
        `SELECT le.id FROM logged_exercises le
         JOIN workout_logs wl ON le.workout_log_id = wl.id
         WHERE wl.status = 'completed' AND LOWER(TRIM(le.name)) = LOWER(TRIM(?))
         ORDER BY wl.started_at DESC LIMIT 1`,
        [ex.name]
      );

      if (prevExercise) {
        const prevSets = await db.getAllAsync<{ weight_kg: number | null; reps: number | null; set_number: number }>(
          "SELECT weight_kg, reps, set_number FROM logged_sets WHERE logged_exercise_id = ? AND is_confirmed = 1 ORDER BY set_number ASC",
          [prevExercise.id]
        );
        if (prevSets.length > 0) {
          for (const s of prevSets) {
            await db.runAsync(
              "INSERT INTO logged_sets (logged_exercise_id, set_number, weight_kg, reps, is_confirmed) VALUES (?, ?, ?, ?, 0)",
              [loggedExId, s.set_number, s.weight_kg, s.reps]
            );
          }
          continue;
        }
      }

      // No history or no confirmed sets: create target_sets empty sets
      for (let i = 1; i <= ex.target_sets; i++) {
        await db.runAsync(
          "INSERT INTO logged_sets (logged_exercise_id, set_number, weight_kg, reps, is_confirmed) VALUES (?, ?, ?, ?, 0)",
          [loggedExId, i, null, null]
        );
      }
    }
  });

  if (newLogId === -1) throw new Error("Failed to create workout");
  return newLogId;
}
