import {
  ActionActivity,
  ActionActivityCounts,
  ActionEventType,
} from '@asobeast/shared';
import {
  addDays,
  DAY_MS,
  startOfUtcDay,
  toDateKey,
} from '../analytics/analytics.support';

export const COUNTED_EVENT_TYPES = [
  'opened',
  'reopened',
  'done',
  'dismissed',
  'resolved',
  'verified',
] as const satisfies readonly ActionEventType[];

type CountedEventType = (typeof COUNTED_EVENT_TYPES)[number];

const isCounted = (type: ActionEventType): type is CountedEventType =>
  COUNTED_EVENT_TYPES.some((counted) => counted === type);

const emptyCounts = (): ActionActivityCounts => ({
  opened: 0,
  reopened: 0,
  done: 0,
  dismissed: 0,
  resolved: 0,
  verified: 0,
});

export function activityWindow(
  today: Date,
  days: number,
): { from: Date; to: Date } {
  const to = startOfUtcDay(today);
  return { from: addDays(to, -(days - 1)), to };
}

export function bucketActivity(
  events: ReadonlyArray<{ type: ActionEventType; occurredAt: Date }>,
  from: Date,
  to: Date,
): ActionActivity {
  const days = new Map<string, ActionActivityCounts>();
  for (let day = from.getTime(); day <= to.getTime(); day += DAY_MS) {
    days.set(toDateKey(new Date(day)), emptyCounts());
  }
  const totals = emptyCounts();
  for (const event of events) {
    const counts = days.get(toDateKey(event.occurredAt));
    if (!counts || !isCounted(event.type)) continue;
    counts[event.type] += 1;
    totals[event.type] += 1;
  }
  return {
    from: toDateKey(from),
    to: toDateKey(to),
    days: [...days.entries()].map(([date, counts]) => ({ date, ...counts })),
    totals,
  };
}
