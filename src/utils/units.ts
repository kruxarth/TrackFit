export const KG_PER_LB = 0.45359237;

export type Unit = "kg" | "lbs";

export function kgToDisplay(kg: number, unit: Unit): number {
  if (unit === "kg") return kg;
  return kg / KG_PER_LB;
}

export function displayToKg(displayVal: number, unit: Unit): number {
  if (unit === "kg") return displayVal;
  return displayVal * KG_PER_LB;
}

export function formatWeight(weightKg: number, unit: Unit): string {
  const display = kgToDisplay(weightKg, unit);
  // round to 1 decimal
  const rounded = Math.round(display * 10) / 10;
  // strip trailing .0
  const str = rounded.toFixed(1);
  return str.endsWith(".0") ? str.slice(0, -2) : str;
}

export function weightStep(unit: Unit): number {
  return unit === "kg" ? 2.5 : 5;
}

export function toggleUnit(unit: Unit): Unit {
  return unit === "kg" ? "lbs" : "kg";
}

/** Prefer a stored per-exercise unit; otherwise fall back to the global setting. */
export function resolveExerciseUnit(stored: string | null | undefined, fallback: Unit): Unit {
  return stored === "kg" || stored === "lbs" ? stored : fallback;
}
