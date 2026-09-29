export function dateDaysAgo(now: Date, days: number): string {
  return new Date(now.getTime() - days * 86_400_000).toISOString().slice(0, 10);
}

export function windowStart(now: Date, days: number): string {
  return dateDaysAgo(now, days - 1);
}

export function withinWindow<T extends { date: string }>(
  rows: readonly T[],
  now: Date,
  days: number,
): T[] {
  const start = windowStart(now, days);
  return rows.filter((row) => row.date >= start);
}
