const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

const ISO_INSTANT =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

const daysInMonth = (year: number, month: number): number =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

const calendarOk = (year: number, month: number, day: number): boolean =>
  month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);

export function isoDateOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const day = ISO_DAY.exec(value);
  if (day !== null) {
    const [year, month, date] = day.slice(1).map(Number);
    return calendarOk(year, month, date) ? value : null;
  }
  const instant = ISO_INSTANT.exec(value);
  if (instant === null) return null;
  const [year, month, date, hour, minute, second] = instant
    .slice(1, 7)
    .map((part) => Number(part ?? 0));
  return calendarOk(year, month, date) &&
    hour <= 23 &&
    minute <= 59 &&
    second <= 60
    ? value
    : null;
}
