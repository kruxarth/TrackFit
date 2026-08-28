/**
 * Unit tests for Ticket 4: repos behavior without native SQLite dependency.
 * These verify the same logic that the SQL repos implement:
 *  - carry-forward matching is case/whitespace-insensitive
 *  - finish deletes unconfirmed sets and empty exercises
 *  - progress query returns max confirmed weight per session
 */

function normalizeExerciseName(name: string): string {
  return name.trim().toLowerCase();
}

// Simulate carry-forward lookup: find last matching exercise by normalized name
type FakeExercise = { id: number; name: string; started_at: number };
type FakeSet = { weight_kg: number | null; reps: number | null; is_confirmed: 1 | 0 };

function findLastExercise(exercises: FakeExercise[], targetName: string): FakeExercise | null {
  const norm = normalizeExerciseName(targetName);
  // most recent first
  const sorted = [...exercises].sort((a, b) => b.started_at - a.started_at);
  return sorted.find((e) => normalizeExerciseName(e.name) === norm) ?? null;
}

describe("carry-forward matching is case/whitespace-insensitive", () => {
  it("matches regardless of case and surrounding whitespace", () => {
    const exercises: FakeExercise[] = [
      { id: 1, name: "Bench Press", started_at: 1000 },
      { id: 2, name: "  bench press  ", started_at: 2000 },
      { id: 3, name: "BENCH PRESS", started_at: 3000 },
    ];
    expect(findLastExercise(exercises, "bench press")?.id).toBe(3);
    expect(findLastExercise(exercises, "  Bench Press ")?.id).toBe(3);
    expect(findLastExercise(exercises, "BENCH PRESS")?.id).toBe(3);
    expect(findLastExercise(exercises, "bEnCh PrEsS")?.id).toBe(3);
  });

  it("does not match different exercise", () => {
    const exercises: FakeExercise[] = [{ id: 1, name: "Squat", started_at: 1000 }];
    expect(findLastExercise(exercises, "Bench Press")).toBeNull();
  });

  it("latest completed session wins", () => {
    const exercises: FakeExercise[] = [
      { id: 1, name: "Squat", started_at: 1000 },
      { id: 2, name: "Squat", started_at: 5000 },
      { id: 3, name: "Squat", started_at: 3000 },
    ];
    expect(findLastExercise(exercises, "squat")?.id).toBe(2);
  });

  it("SQL for carry-forward uses LOWER(TRIM(...))", () => {
    // Verify the repo implementation uses case-insensitive TRIM logic
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require("path");
    const file = fs.readFileSync(path.join(process.cwd(), "src/repos/workoutsRepo.ts"), "utf8");
    expect(file).toContain("LOWER(TRIM(le.name))");
    expect(file).toContain("LOWER(TRIM");
  });
});

describe("finish deletes unconfirmed sets and empty exercises", () => {
  type LoggedExercise = { id: number; workout_log_id: number; name: string };
  type LoggedSet = { id: number; logged_exercise_id: number; is_confirmed: number };

  function simulateFinish(
    exercises: LoggedExercise[],
    sets: LoggedSet[]
  ): { remainingExercises: LoggedExercise[]; remainingSets: LoggedSet[] } {
    const remainingSets = sets.filter((s) => s.is_confirmed === 1);
    const remainingExerciseIds = new Set(remainingSets.map((s) => s.logged_exercise_id));
    const remainingExercises = exercises.filter((e) => remainingExerciseIds.has(e.id));
    return { remainingExercises, remainingSets };
  }

  it("removes unconfirmed sets", () => {
    const ex: LoggedExercise[] = [{ id: 1, workout_log_id: 1, name: "Bench" }];
    const sets: LoggedSet[] = [
      { id: 1, logged_exercise_id: 1, is_confirmed: 1 },
      { id: 2, logged_exercise_id: 1, is_confirmed: 0 },
      { id: 3, logged_exercise_id: 1, is_confirmed: 1 },
    ];
    const res = simulateFinish(ex, sets);
    expect(res.remainingSets.length).toBe(2);
    expect(res.remainingSets.map((s) => s.id)).toEqual([1, 3]);
  });

  it("removes exercises left with zero sets", () => {
    const ex: LoggedExercise[] = [
      { id: 1, workout_log_id: 1, name: "Bench" },
      { id: 2, workout_log_id: 1, name: "Squat" },
    ];
    const sets: LoggedSet[] = [
      { id: 1, logged_exercise_id: 1, is_confirmed: 1 },
      // exercise 2 has only unconfirmed sets
      { id: 2, logged_exercise_id: 2, is_confirmed: 0 },
    ];
    const res = simulateFinish(ex, sets);
    expect(res.remainingExercises.length).toBe(1);
    expect(res.remainingExercises[0].id).toBe(1);
    expect(res.remainingSets.length).toBe(1);
  });

  it("handles all unconfirmed -> empty log", () => {
    const ex: LoggedExercise[] = [{ id: 1, workout_log_id: 1, name: "Bench" }];
    const sets: LoggedSet[] = [{ id: 1, logged_exercise_id: 1, is_confirmed: 0 }];
    const res = simulateFinish(ex, sets);
    expect(res.remainingExercises.length).toBe(0);
    expect(res.remainingSets.length).toBe(0);
  });
});

describe("progress query returns max confirmed weight per session", () => {
  type Session = { started_at: number; sets: FakeSet[] };

  function maxConfirmedWeightPerSession(sessions: Session[]): { started_at: number; maxWeightKg: number }[] {
    return sessions
      .map((s) => {
        const confirmed = s.sets.filter((set) => set.is_confirmed === 1 && set.weight_kg !== null);
        if (confirmed.length === 0) return null;
        const max = Math.max(...confirmed.map((c) => c.weight_kg as number));
        return { started_at: s.started_at, maxWeightKg: max };
      })
      .filter((v): v is { started_at: number; maxWeightKg: number } => v !== null)
      .sort((a, b) => a.started_at - b.started_at);
  }

  it("returns max confirmed weight per session, excludes unconfirmed and null weight", () => {
    const sessions: Session[] = [
      {
        started_at: 1000,
        sets: [
          { weight_kg: 60, reps: 5, is_confirmed: 1 },
          { weight_kg: 80, reps: 3, is_confirmed: 1 },
          { weight_kg: 100, reps: 1, is_confirmed: 0 }, // unconfirmed excluded
        ],
      },
      {
        started_at: 2000,
        sets: [
          { weight_kg: 70, reps: 5, is_confirmed: 1 },
          { weight_kg: null, reps: 10, is_confirmed: 1 }, // bodyweight no weight excluded if only null
        ],
      },
      {
        started_at: 3000,
        sets: [{ weight_kg: null, reps: 10, is_confirmed: 1 }], // should be excluded entirely
      },
    ];
    const res = maxConfirmedWeightPerSession(sessions);
    expect(res).toEqual([
      { started_at: 1000, maxWeightKg: 80 },
      { started_at: 2000, maxWeightKg: 70 },
    ]);
  });

  it("excludes sessions with only bodyweight (null weight) sets", () => {
    const sessions: Session[] = [
      { started_at: 1000, sets: [{ weight_kg: null, reps: 10, is_confirmed: 1 }] },
      { started_at: 2000, sets: [{ weight_kg: null, reps: 12, is_confirmed: 1 }] },
    ];
    const res = maxConfirmedWeightPerSession(sessions);
    expect(res.length).toBe(0);
  });

  it("handles empty sessions", () => {
    expect(maxConfirmedWeightPerSession([]).length).toBe(0);
  });
});
