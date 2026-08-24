import { DAY_MS } from './rankings.support';

export const IMPLAUSIBLE_LOOKBACK_DAYS = 7;

export function isImplausiblyEmpty(input: {
  resultCount: number;
  lastRankedOn: Date | null;
  today: Date;
}): boolean {
  if (input.resultCount > 0 || !input.lastRankedOn) return false;
  const age = input.today.getTime() - input.lastRankedOn.getTime();
  return age > 0 && age <= IMPLAUSIBLE_LOOKBACK_DAYS * DAY_MS;
}
