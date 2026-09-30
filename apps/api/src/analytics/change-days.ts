import { startOfUtcDay } from './analytics.support';

export interface ChangeStamp {
  appId: string;
  capturedAt: Date;
}

export function countChangeDays(
  events: readonly ChangeStamp[],
): Map<string, number> {
  const daysByApp = new Map<string, Set<number>>();
  for (const { appId, capturedAt } of events) {
    const days = daysByApp.get(appId) ?? new Set<number>();
    days.add(startOfUtcDay(capturedAt).getTime());
    daysByApp.set(appId, days);
  }
  return new Map(
    [...daysByApp].map(([appId, days]) => [appId, days.size] as const),
  );
}
