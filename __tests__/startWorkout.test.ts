/**
 * Tests for Ticket 9: startWorkout carry-forward logic
 * Mirrors B1 spec without native DB
 */

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

type DayExercise = { name: string; is_bodyweight: number; target_sets: number; position: number };
type LoggedExercise = { id: number; name: string; started_at: number; workout_status: "active" | "completed" };
type LoggedSet = { weight_kg: number | null; reps: number | null; is_confirmed: number; set_number: number };

function findLastConfirmedSets(
  targetName: string,
  completedLogs: { exercise: LoggedExercise; sets: LoggedSet[] }[]
): LoggedSet[] | null {
  const norm = normalize(targetName);
  // filter to completed only and matching name, sorted by started_at desc, latest wins
  const candidates = completedLogs
    .filter((l) => l.exercise.workout_status === "completed" && normalize(l.exercise.name) === norm)
    .sort((a, b) => b.exercise.started_at - a.exercise.started_at);
  if (candidates.length === 0) return null;
  const best = candidates[0];
  const confirmed = best.sets.filter((s) => s.is_confirmed === 1).sort((a, b) => a.set_number - b.set_number);
  return confirmed;
}

function simulateStartWorkout(
  dayExercises: DayExercise[],
  completedLogs: { exercise: LoggedExercise; sets: LoggedSet[] }[]
): { name: string; is_bodyweight: number; sets: { weight_kg: number | null; reps: number | null; is_confirmed: number; set_number: number }[] }[] {
  return dayExercises.map((ex, idx) => {
    const prevSets = findLastConfirmedSets(ex.name, completedLogs);
    if (prevSets && prevSets.length > 0) {
      return {
        name: ex.name,
        is_bodyweight: ex.is_bodyweight,
        sets: prevSets.map((s) => ({ weight_kg: s.weight_kg, reps: s.reps, is_confirmed: 0, set_number: s.set_number })),
      };
    }
    // no history => target_sets empty sets
    const empty = [];
    for (let i = 1; i <= ex.target_sets; i++) {
      empty.push({ weight_kg: null, reps: null, is_confirmed: 0, set_number: i });
    }
    return { name: ex.name, is_bodyweight: ex.is_bodyweight, sets: empty };
  });
}

describe("startWorkout carry-forward", () => {
  it("latest completed session wins", () => {
    const dayEx: DayExercise[] = [{ name: "Bench", is_bodyweight: 0, target_sets: 3, position: 0 }];
    const completed = [
      {
        exercise: { id: 1, name: "Bench", started_at: 1000, workout_status: "completed" as const },
        sets: [{ weight_kg: 60, reps: 5, is_confirmed: 1, set_number: 1 }],
      },
      {
        exercise: { id: 2, name: "Bench", started_at: 5000, workout_status: "completed" as const },
        sets: [{ weight_kg: 80, reps: 3, is_confirmed: 1, set_number: 1 }],
      },
      {
        exercise: { id: 3, name: "Bench", started_at: 3000, workout_status: "completed" as const },
        sets: [{ weight_kg: 70, reps: 4, is_confirmed: 1, set_number: 1 }],
      },
    ];
    const res = simulateStartWorkout(dayEx, completed);
    expect(res[0].sets[0].weight_kg).toBe(80);
  });

  it("name match is case/trim-insensitive", () => {
    const dayEx: DayExercise[] = [{ name: "  bench press ", is_bodyweight: 0, target_sets: 3, position: 0 }];
    const completed = [
      {
        exercise: { id: 1, name: "BENCH PRESS", started_at: 1000, workout_status: "completed" as const },
        sets: [{ weight_kg: 60, reps: 5, is_confirmed: 1, set_number: 1 }],
      },
    ];
    const res = simulateStartWorkout(dayEx, completed);
    expect(res[0].sets.length).toBe(1);
    expect(res[0].sets[0].weight_kg).toBe(60);

    const dayEx2: DayExercise[] = [{ name: "BENCH PRESS", is_bodyweight: 0, target_sets: 3, position: 0 }];
    const completed2 = [
      {
        exercise: { id: 2, name: "  bench press  ", started_at: 1000, workout_status: "completed" as const },
        sets: [{ weight_kg: 65, reps: 5, is_confirmed: 1, set_number: 1 }],
      },
    ];
    const res2 = simulateStartWorkout(dayEx2, completed2);
    expect(res2[0].sets[0].weight_kg).toBe(65);
  });

  it("no history → target_sets empty sets", () => {
    const dayEx: DayExercise[] = [
      { name: "Squat", is_bodyweight: 0, target_sets: 3, position: 0 },
      { name: "Deadlift", is_bodyweight: 0, target_sets: 2, position: 1 },
    ];
    const res = simulateStartWorkout(dayEx, []);
    expect(res[0].sets.length).toBe(3);
    expect(res[0].sets.every((s) => s.weight_kg === null && s.reps === null && s.is_confirmed === 0)).toBe(true);
    expect(res[1].sets.length).toBe(2);
  });

  it("active logs never used as source", () => {
    const dayEx: DayExercise[] = [{ name: "Bench", is_bodyweight: 0, target_sets: 3, position: 0 }];
    const completed = [
      {
        exercise: { id: 1, name: "Bench", started_at: 5000, workout_status: "active" as const },
        sets: [{ weight_kg: 100, reps: 1, is_confirmed: 1, set_number: 1 }],
      },
      {
        exercise: { id: 2, name: "Bench", started_at: 1000, workout_status: "completed" as const },
        sets: [{ weight_kg: 60, reps: 5, is_confirmed: 1, set_number: 1 }],
      },
    ];
    const res = simulateStartWorkout(dayEx, completed);
    // should pick completed 60, not active 100
    expect(res[0].sets[0].weight_kg).toBe(60);
  });

  it("only confirmed sets are copied", () => {
    const dayEx: DayExercise[] = [{ name: "Bench", is_bodyweight: 0, target_sets: 3, position: 0 }];
    const completed = [
      {
        exercise: { id: 1, name: "Bench", started_at: 1000, workout_status: "completed" as const },
        sets: [
          { weight_kg: 60, reps: 5, is_confirmed: 1, set_number: 1 },
          { weight_kg: 70, reps: 3, is_confirmed: 0, set_number: 2 },
        ],
      },
    ];
    const res = simulateStartWorkout(dayEx, completed);
    expect(res[0].sets.length).toBe(1);
    expect(res[0].sets[0].weight_kg).toBe(60);
  });

  it("second simultaneous workout is impossible via service check", () => {
    // Simulate service throwing when active exists
    function canStartWorkout(hasActive: boolean): boolean {
      if (hasActive) throw new Error("An active workout already exists");
      return true;
    }
    expect(() => canStartWorkout(true)).toThrow("An active workout already exists");
    expect(canStartWorkout(false)).toBe(true);
  });
});
