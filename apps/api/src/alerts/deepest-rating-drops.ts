import type { OutboxEvent } from './alert-batch';

function ratingDropDay(event: OutboxEvent): string | null {
  return event.payload.event === 'rating.dropped'
    ? `${event.payload.app.id}:${event.payload.toDate}`
    : null;
}

function dropTenthsOf(event: OutboxEvent): number {
  return event.payload.event === 'rating.dropped'
    ? event.payload.dropTenths
    : 0;
}

export function withDeepestRatingDrops(events: OutboxEvent[]): OutboxEvent[] {
  const deepest = new Map<string, OutboxEvent>();
  for (const event of events) {
    const day = ratingDropDay(event);
    const kept = day === null ? undefined : deepest.get(day);
    if (day !== null && (!kept || dropTenthsOf(event) > dropTenthsOf(kept))) {
      deepest.set(day, event);
    }
  }
  return events.filter((event) => {
    const day = ratingDropDay(event);
    return day === null || deepest.get(day) === event;
  });
}
