import type { Store } from '../index';
import type { AlertAppIdentity } from './changes';

export interface RatingDroppedPayload {
  event: 'rating.dropped';
  occurredAt: string;
  app: { id: string; name: string | null } & AlertAppIdentity;
  country: string;
  from: number;
  to: number;
  fromCount: number;
  toCount: number;
  fromDate: string;
  toDate: string;
  dropTenths: number;
  version: string | null;
  actionId: string | null;
}

export interface AppDelistedPayload {
  event: 'app.delisted';
  occurredAt: string;
  app: {
    id: string;
    name: string | null;
    isCompetitor: boolean;
  } & AlertAppIdentity;
  store: Store;
  country: string;
  date: string;
}

export interface AppUnlistedMarketPayload {
  event: 'app.unlisted_market';
  occurredAt: string;
  app: {
    id: string;
    name: string | null;
    isCompetitor: boolean;
  } & AlertAppIdentity;
  store: Store;
  country: string;
  market: string;
  date: string;
  trackedKeywords: number;
}

export type AppAvailabilityPayload =
  AppDelistedPayload | AppUnlistedMarketPayload;

export function isAvailabilityPayload(payload: {
  event: string;
}): payload is AppAvailabilityPayload {
  return (
    payload.event === 'app.delisted' || payload.event === 'app.unlisted_market'
  );
}
