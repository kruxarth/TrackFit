import { kgToDisplay, displayToKg, formatWeight, weightStep, KG_PER_LB, toggleUnit, resolveExerciseUnit } from "../src/utils/units";

describe("units", () => {
  it("formatWeight 60 kg in lbs is 132.3", () => {
    expect(formatWeight(60, "lbs")).toBe("132.3");
  });

  it("formatWeight strips trailing .0", () => {
    expect(formatWeight(60, "kg")).toBe("60");
    expect(formatWeight(62.5, "kg")).toBe("62.5");
    // 61.25 kg in kg mode should format to 61.3 (rounded to 1 decimal)
    expect(formatWeight(61.25, "kg")).toBe("61.3");
    expect(formatWeight(0, "kg")).toBe("0");
  });

  it("kgToDisplay and displayToKg are inverse for lbs", () => {
    const values = [0, 20, 60, 100, 61.25, 82.5];
    for (const x of values) {
      const display = kgToDisplay(x, "lbs");
      const back = displayToKg(display, "lbs");
      expect(Math.abs(back - x)).toBeLessThan(1e-9);
    }
  });

  it("kg mode is identity", () => {
    expect(kgToDisplay(60, "kg")).toBe(60);
    expect(displayToKg(60, "kg")).toBe(60);
    expect(kgToDisplay(0, "kg")).toBe(0);
  });

  it("weightStep returns correct step", () => {
    expect(weightStep("kg")).toBe(2.5);
    expect(weightStep("lbs")).toBe(5);
  });

  it("toggleUnit flips kg and lbs", () => {
    expect(toggleUnit("kg")).toBe("lbs");
    expect(toggleUnit("lbs")).toBe("kg");
  });

  it("resolveExerciseUnit prefers stored per-exercise unit", () => {
    expect(resolveExerciseUnit("lbs", "kg")).toBe("lbs");
    expect(resolveExerciseUnit("kg", "lbs")).toBe("kg");
    expect(resolveExerciseUnit(null, "lbs")).toBe("lbs");
    expect(resolveExerciseUnit(undefined, "kg")).toBe("kg");
    expect(resolveExerciseUnit("stone", "kg")).toBe("kg");
  });

  it("round-trip lbs with multiple values within 1e-9", () => {
    for (let i = 0; i < 10; i++) {
      const x = Math.random() * 200;
      const d = kgToDisplay(x, "lbs");
      const back = displayToKg(d, "lbs");
      expect(Math.abs(back - x)).toBeLessThan(1e-9);
    }
  });

  it("KG_PER_LB constant is correct", () => {
    expect(KG_PER_LB).toBeCloseTo(0.45359237, 10);
  });

  it("formatWeight handles lbs with different weights", () => {
    // 100 kg = 220.462... => 220.5
    expect(formatWeight(100, "lbs")).toBe("220.5");
    // 20 kg = 44.092... => 44.1
    expect(formatWeight(20, "lbs")).toBe("44.1");
  });
});
