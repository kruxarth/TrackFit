import { escapeField, buildCsv } from "../src/utils/csv";

describe("csv escaping", () => {
  it("escapes comma", () => {
    expect(escapeField("a,b")).toBe('"a,b"');
  });
  it("escapes quote", () => {
    expect(escapeField('a"b')).toBe('"a""b"');
  });
  it("escapes newline", () => {
    expect(escapeField("a\nb")).toBe('"a\nb"');
  });
  it("plain field", () => {
    expect(escapeField("abc")).toBe("abc");
  });
  it('Bench, "heavy" round-trips correctly', () => {
    const field = 'Bench, "heavy"';
    const escaped = escapeField(field);
    expect(escaped).toBe('"Bench, ""heavy"""');
    // Simulate parsing: wrapped in quotes with doubled quotes
  });
  it("buildCsv uses header and rows", () => {
    const header = ["date", "weight_kg"];
    const rows: string[][] = [
      ["2026-08-26", "70"],
      ["2026-08-27", "71.5"],
    ];
    const csv = buildCsv(header, rows);
    expect(csv).toBe("date,weight_kg\n2026-08-26,70\n2026-08-27,71.5\n");
  });
  it("workouts row shape fixture", () => {
    const header = ["date", "workout_id", "day_name", "exercise", "set_number", "weight_kg", "reps", "is_bodyweight", "exercise_notes"];
    const rows = [
      ["2026-08-26", "1", "Push Day A", 'Bench, "heavy"', "1", "60", "5", "0", ""],
      ["2026-08-26", "1", "Push Day A", "Squat", "2", "", "10", "1", "felt good"],
    ];
    const csv = buildCsv(header, rows);
    expect(csv).toContain('"Bench, ""heavy"""');
    expect(csv.split("\n").length).toBe(4); // header +2 rows + trailing empty line
  });
  it("empty string for NULL weight", () => {
    const header = ["date", "workout_id", "day_name", "exercise", "set_number", "weight_kg", "reps", "is_bodyweight", "exercise_notes"];
    const rows = [["2026-08-26", "1", "Day", "Pull-up", "1", "", "10", "1", ""]];
    const csv = buildCsv(header, rows);
    expect(csv).toContain(",1,,10,1,");
    // Specifically weight_kg column empty
    const lines = csv.split("\n");
    expect(lines[1]).toBe('2026-08-26,1,Day,Pull-up,1,,10,1,');
  });
});
