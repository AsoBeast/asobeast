import type { RatingDroppedPayload } from '@asobeast/shared';
import type { OutboxEvent } from './alert-batch';

type RatingDropEvent = OutboxEvent & { payload: RatingDroppedPayload };

function isRatingDrop(event: OutboxEvent): event is RatingDropEvent {
  return event.payload.event === 'rating.dropped';
}

function dropDay(event: RatingDropEvent): string {
  return `${event.payload.app.id}:${event.payload.toDate}`;
}

export function withDeepestRatingDrops(events: OutboxEvent[]): OutboxEvent[] {
  const deepest = new Map<string, RatingDropEvent>();
  for (const event of events.filter(isRatingDrop)) {
    const kept = deepest.get(dropDay(event));
    if (!kept || event.payload.dropTenths > kept.payload.dropTenths) {
      deepest.set(dropDay(event), event);
    }
  }
  return events.filter(
    (event) => !isRatingDrop(event) || deepest.get(dropDay(event)) === event,
  );
}
