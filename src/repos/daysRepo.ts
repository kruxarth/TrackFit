import { getDatabase } from "../db/database";

export type DayRow = {
  id: number;
  name: string;
  position: number;
  created_at: number;
};

export type DayExerciseRow = {
  id: number;
  day_id: number;
  name: string;
  is_bodyweight: number;
  target_sets: number;
  position: number;
};

export async function createDay(name: string): Promise<DayRow> {
  const db = await getDatabase();
  const now = Date.now();
  const rows = await db.getAllAsync<{ maxPos: number | null }>("SELECT MAX(position) as maxPos FROM days");
  const maxPos = rows[0]?.maxPos ?? -1;
  const nextPos = maxPos + 1;
  const res = await db.runAsync("INSERT INTO days (name, position, created_at) VALUES (?, ?, ?)", [name, nextPos, now]);
  const id = res.lastInsertRowId;
  const row = await db.getFirstAsync<DayRow>("SELECT * FROM days WHERE id = ?", [id]);
  if (!row) throw new Error("Failed to create day");
  return row;
}

export async function getDays(): Promise<DayRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<DayRow>("SELECT * FROM days ORDER BY position ASC, id ASC");
}

export async function getDayById(id: number): Promise<DayRow | null> {
  const db = await getDatabase();
  return db.getFirstAsync<DayRow>("SELECT * FROM days WHERE id = ?", [id]);
}

export async function updateDayName(id: number, name: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("UPDATE days SET name = ? WHERE id = ?", [name, id]);
}

export async function deleteDay(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM days WHERE id = ?", [id]);
}

export async function reorderDays(orderedIds: number[]): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.runAsync("UPDATE days SET position = ? WHERE id = ?", [i, orderedIds[i]]);
    }
  });
}

export async function getDayExercises(dayId: number): Promise<DayExerciseRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<DayExerciseRow>("SELECT * FROM day_exercises WHERE day_id = ? ORDER BY position ASC, id ASC", [dayId]);
}

export async function addDayExercise(
  dayId: number,
  name: string,
  isBodyweight = 0,
  targetSets = 3
): Promise<DayExerciseRow> {
  const db = await getDatabase();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Exercise name cannot be empty");
  const rows = await db.getAllAsync<{ maxPos: number | null }>("SELECT MAX(position) as maxPos FROM day_exercises WHERE day_id = ?", [dayId]);
  const maxPos = rows[0]?.maxPos ?? -1;
  const nextPos = maxPos + 1;
  const res = await db.runAsync(
    "INSERT INTO day_exercises (day_id, name, is_bodyweight, target_sets, position) VALUES (?, ?, ?, ?, ?)",
    [dayId, trimmed, isBodyweight ? 1 : 0, targetSets, nextPos]
  );
  const id = res.lastInsertRowId;
  const row = await db.getFirstAsync<DayExerciseRow>("SELECT * FROM day_exercises WHERE id = ?", [id]);
  if (!row) throw new Error("Failed to create exercise");
  return row;
}

export async function updateDayExercise(
  id: number,
  fields: Partial<{ name: string; is_bodyweight: number; target_sets: number; position: number }>
): Promise<void> {
  const db = await getDatabase();
  const sets: string[] = [];
  const vals: (string | number | null)[] = [];
  if (fields.name !== undefined) {
    const trimmed = fields.name.trim();
    if (!trimmed) throw new Error("Exercise name cannot be empty");
    sets.push("name = ?");
    vals.push(trimmed);
  }
  if (fields.is_bodyweight !== undefined) {
    sets.push("is_bodyweight = ?");
    vals.push(fields.is_bodyweight ? 1 : 0);
  }
  if (fields.target_sets !== undefined) {
    const v = Math.max(1, Math.min(10, fields.target_sets));
    sets.push("target_sets = ?");
    vals.push(v);
  }
  if (fields.position !== undefined) {
    sets.push("position = ?");
    vals.push(fields.position);
  }
  if (sets.length === 0) return;
  vals.push(id);
  await db.runAsync(`UPDATE day_exercises SET ${sets.join(", ")} WHERE id = ?`, vals as unknown as (string | number | null)[]);
}

export async function deleteDayExercise(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM day_exercises WHERE id = ?", [id]);
}

export async function reorderDayExercises(dayId: number, orderedIds: number[]): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.runAsync("UPDATE day_exercises SET position = ? WHERE id = ? AND day_id = ?", [i, orderedIds[i], dayId]);
    }
  });
}

// Move exercise up/down by swapping positions
export async function moveDayExercise(dayId: number, exerciseId: number, direction: "up" | "down"): Promise<void> {
  const db = await getDatabase();
  const exercises = await getDayExercises(dayId);
  const idx = exercises.findIndex((e) => e.id === exerciseId);
  if (idx === -1) return;
  const targetIdx = direction === "up" ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= exercises.length) return;
  const a = exercises[idx];
  const b = exercises[targetIdx];
  await db.withTransactionAsync(async () => {
    await db.runAsync("UPDATE day_exercises SET position = ? WHERE id = ?", [b.position, a.id]);
    await db.runAsync("UPDATE day_exercises SET position = ? WHERE id = ?", [a.position, b.id]);
  });
}
