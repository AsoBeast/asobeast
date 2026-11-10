const DAY_MS = 86_400_000;

export const utcDayNumber = (date: string): number =>
  Math.round(Date.parse(`${date}T00:00:00Z`) / DAY_MS);

export const dayBefore = (date: string, days: number): string =>
  new Date((utcDayNumber(date) - days) * DAY_MS).toISOString().slice(0, 10);
