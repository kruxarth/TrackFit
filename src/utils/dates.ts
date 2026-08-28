export function todayLocalISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function toLocalISO(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function monthsAgo(n: number): number {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.getTime();
}

export const CHART_RANGES = ["1M", "3M", "6M", "1Y", "All"] as const;
export type ChartRange = (typeof CHART_RANGES)[number];

export function rangeToSince(range: ChartRange): number | undefined {
  if (range === "1M") return monthsAgo(1);
  if (range === "3M") return monthsAgo(3);
  if (range === "6M") return monthsAgo(6);
  if (range === "1Y") return monthsAgo(12);
  return undefined;
}

export function startOfLocalDay(d: Date = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

export function addLocalDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}
