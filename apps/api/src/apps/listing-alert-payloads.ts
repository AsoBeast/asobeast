import type { RatingDroppedPayload } from '@asobeast/shared';
import type { RatingDrop } from './rating-drop';

export interface ListingAlertApp {
  id: string;
  name: string | null;
  country: string;
}

export function ratingDroppedPayload(
  app: ListingAlertApp,
  drop: RatingDrop,
  actionId: string | null,
  occurredAt: Date,
): RatingDroppedPayload {
  return {
    event: 'rating.dropped',
    occurredAt: occurredAt.toISOString(),
    app: { id: app.id, name: app.name },
    country: app.country,
    ...drop,
    actionId,
  };
}
