import {
  utcDayOf,
  type AppDelistedPayload,
  type AppUnlistedMarketPayload,
  type RatingDroppedPayload,
  type Store,
} from '@asobeast/shared';
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

export interface AvailabilityAlertApp extends ListingAlertApp {
  store: Store;
  isCompetitor: boolean;
}

function availabilityBase(app: AvailabilityAlertApp, occurredAt: Date) {
  return {
    occurredAt: occurredAt.toISOString(),
    app: { id: app.id, name: app.name, isCompetitor: app.isCompetitor },
    store: app.store,
    country: app.country,
    date: utcDayOf(occurredAt),
  };
}

export function delistedPayload(
  app: AvailabilityAlertApp,
  occurredAt: Date,
): AppDelistedPayload {
  return { event: 'app.delisted', ...availabilityBase(app, occurredAt) };
}

export function unlistedMarketPayload(
  app: AvailabilityAlertApp,
  market: string,
  trackedKeywords: number,
  occurredAt: Date,
): AppUnlistedMarketPayload {
  return {
    event: 'app.unlisted_market',
    ...availabilityBase(app, occurredAt),
    market,
    trackedKeywords,
  };
}
