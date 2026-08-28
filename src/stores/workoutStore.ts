import { create } from "zustand";
import { getDatabase } from "../db/database";
import type { WorkoutLogRow, LoggedExerciseRow, LoggedSetRow } from "../repos/workoutsRepo";

type ExerciseWithSets = {
  exercise: LoggedExerciseRow;
  sets: LoggedSetRow[];
};

type WorkoutState = {
  activeLogId: number | null;
  activeLog: WorkoutLogRow | null;
  exercises: ExerciseWithSets[];
  hydrated: boolean;
  restTimerEndsAt: number | null;

  hydrate: () => Promise<void>;
  setActiveLogId: (id: number | null) => void;
  clear: () => void;
  setRestTimerEndsAt: (endsAt: number | null) => void;

  // Mutations that mirror SQLite (for Ticket 10, will be expanded)
  loadExercisesForLog: (logId: number) => Promise<void>;
  updateSet: (setId: number, fields: Partial<{ weight_kg: number | null; reps: number | null }>) => Promise<void>;
  confirmSet: (setId: number, confirm: boolean) => Promise<void>;
  addSet: (exerciseId: number) => Promise<void>;
  deleteSet: (setId: number) => Promise<void>;
  addExercise: (logId: number, name: string, isBodyweight: boolean) => Promise<void>;
  deleteExercise: (exerciseId: number) => Promise<void>;
  updateExerciseNotes: (exerciseId: number, notes: string | null) => Promise<void>;
};

export const useWorkoutStore = create<WorkoutState>((set, get) => ({
  activeLogId: null,
  activeLog: null,
  exercises: [],
  hydrated: false,
  restTimerEndsAt: null,

  hydrate: async () => {
    const db = await getDatabase();
    const active = await db.getFirstAsync<WorkoutLogRow>("SELECT * FROM workout_logs WHERE status = 'active' ORDER BY started_at DESC LIMIT 1");
    if (active) {
      set({ activeLogId: active.id, activeLog: active, hydrated: true });
      await get().loadExercisesForLog(active.id);
    } else {
      set({ activeLogId: null, activeLog: null, exercises: [], hydrated: true });
    }
  },

  setActiveLogId: (id) => set({ activeLogId: id }),

  clear: () => set({ activeLogId: null, activeLog: null, exercises: [], restTimerEndsAt: null }),

  setRestTimerEndsAt: (endsAt) => set({ restTimerEndsAt: endsAt }),

  loadExercisesForLog: async (logId) => {
    const db = await getDatabase();
    const exercises = await db.getAllAsync<LoggedExerciseRow>("SELECT * FROM logged_exercises WHERE workout_log_id = ? ORDER BY position ASC, id ASC", [logId]);
    const result: ExerciseWithSets[] = [];
    for (const ex of exercises) {
      const sets = await db.getAllAsync<LoggedSetRow>("SELECT * FROM logged_sets WHERE logged_exercise_id = ? ORDER BY set_number ASC, id ASC", [ex.id]);
      result.push({ exercise: ex, sets });
    }
    const log = await db.getFirstAsync<WorkoutLogRow>("SELECT * FROM workout_logs WHERE id = ?", [logId]);
    set({ exercises: result, activeLog: log ?? get().activeLog });
  },

  updateSet: async (setId, fields) => {
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
    if (sets.length > 0) {
      vals.push(setId);
      await db.runAsync(`UPDATE logged_sets SET ${sets.join(", ")} WHERE id = ?`, vals as unknown as (string | number | null)[]);
      // Refresh
      const current = get().activeLogId;
      if (current) await get().loadExercisesForLog(current);
    }
  },

  confirmSet: async (setId, confirm) => {
    const db = await getDatabase();
    if (confirm) {
      await db.runAsync("UPDATE logged_sets SET is_confirmed = 1, completed_at = ? WHERE id = ?", [Date.now(), setId]);
    } else {
      await db.runAsync("UPDATE logged_sets SET is_confirmed = 0, completed_at = NULL WHERE id = ?", [setId]);
    }
    const current = get().activeLogId;
    if (current) await get().loadExercisesForLog(current);
  },

  addSet: async (exerciseId) => {
    const db = await getDatabase();
    const maxRow = await db.getFirstAsync<{ maxNum: number | null }>("SELECT MAX(set_number) as maxNum FROM logged_sets WHERE logged_exercise_id = ?", [exerciseId]);
    const next = (maxRow?.maxNum ?? 0) + 1;
    await db.runAsync("INSERT INTO logged_sets (logged_exercise_id, set_number, weight_kg, reps, is_confirmed) VALUES (?, ?, ?, ?, 0)", [exerciseId, next, null, null]);
    const current = get().activeLogId;
    if (current) await get().loadExercisesForLog(current);
  },

  deleteSet: async (setId) => {
    const db = await getDatabase();
    await db.runAsync("DELETE FROM logged_sets WHERE id = ?", [setId]);
    const current = get().activeLogId;
    if (current) await get().loadExercisesForLog(current);
  },

  addExercise: async (logId, name, isBodyweight) => {
    const db = await getDatabase();
    const maxRow = await db.getFirstAsync<{ maxPos: number | null }>("SELECT MAX(position) as maxPos FROM logged_exercises WHERE workout_log_id = ?", [logId]);
    const nextPos = (maxRow?.maxPos ?? -1) + 1;
    const res = await db.runAsync("INSERT INTO logged_exercises (workout_log_id, name, is_bodyweight, position) VALUES (?, ?, ?, ?)", [
      logId,
      name.trim(),
      isBodyweight ? 1 : 0,
      nextPos,
    ]);
    const newExId = res.lastInsertRowId;
    await db.runAsync("INSERT INTO logged_sets (logged_exercise_id, set_number, weight_kg, reps, is_confirmed) VALUES (?, ?, ?, ?, 0)", [newExId, 1, null, null]);
    await get().loadExercisesForLog(logId);
  },

  deleteExercise: async (exerciseId) => {
    const db = await getDatabase();
    await db.runAsync("DELETE FROM logged_exercises WHERE id = ?", [exerciseId]);
    const current = get().activeLogId;
    if (current) await get().loadExercisesForLog(current);
  },

  updateExerciseNotes: async (exerciseId, notes) => {
    const db = await getDatabase();
    await db.runAsync("UPDATE logged_exercises SET notes = ? WHERE id = ?", [notes, exerciseId]);
    const current = get().activeLogId;
    if (current) await get().loadExercisesForLog(current);
  },
}));
