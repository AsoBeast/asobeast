export const DAY_MS = 24 * 60 * 60 * 1000;

export const IMPLAUSIBLE_LOOKBACK_DAYS = 7;

export function isImplausiblyEmpty(input: {
  resultCount: number;
  lastSeenOn: Date | null;
  today: Date;
}): boolean {
  if (input.resultCount > 0 || !input.lastSeenOn) return false;
  const age = input.today.getTime() - input.lastSeenOn.getTime();
  return age > 0 && age <= IMPLAUSIBLE_LOOKBACK_DAYS * DAY_MS;
}
