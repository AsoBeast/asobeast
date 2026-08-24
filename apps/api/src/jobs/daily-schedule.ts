const DAILY_PATTERN = /^(\d{1,2})\s+(\d{1,2})\s+\*\s+\*\s+\*$/;
const DAY_MS = 24 * 60 * 60_000;

export function nextDailyRun(cron: string, now: Date): Date | null {
  const match = DAILY_PATTERN.exec(cron.trim());
  if (!match) return null;

  const minute = Number(match[1]);
  const hour = Number(match[2]);
  if (minute > 59 || hour > 23) return null;

  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    hour,
    minute,
  );
  return new Date(today > now.getTime() ? today : today + DAY_MS);
}

export function previousDailyRun(cron: string, now: Date): Date | null {
  const next = nextDailyRun(cron, now);
  return next === null ? null : new Date(next.getTime() - DAY_MS);
}

export function completionHours(
  requests: number,
  capacityPerDay: number,
): number | null {
  if (requests <= 0) return 0;
  if (capacityPerDay <= 0) return null;
  return Math.round((requests / (capacityPerDay / 24)) * 100) / 100;
}
