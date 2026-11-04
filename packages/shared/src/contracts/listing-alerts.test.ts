import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  isAvailabilityPayload,
  type AppAvailabilityPayload,
  type AppDelistedPayload,
  type AppUnlistedMarketPayload,
} from './listing-alerts';

const app = { id: 'a', name: 'My App', isCompetitor: false };

const delisted: AppDelistedPayload = {
  event: 'app.delisted',
  occurredAt: '2026-11-03T03:10:00.000Z',
  app,
  store: 'APP_STORE',
  country: 'us',
  date: '2026-11-03',
};

const unlisted: AppUnlistedMarketPayload = {
  event: 'app.unlisted_market',
  occurredAt: '2026-11-03T03:10:00.000Z',
  app,
  store: 'APP_STORE',
  country: 'us',
  market: 'de',
  date: '2026-11-03',
  trackedKeywords: 12,
};

describe('isAvailabilityPayload', () => {
  it('knows both availability events', () => {
    expect(isAvailabilityPayload(delisted)).toBe(true);
    expect(isAvailabilityPayload(unlisted)).toBe(true);
  });

  it.each([
    'metadata.changed',
    'rank.dropped',
    'rating.dropped',
    'alerts.batch',
  ])('refuses %s', (event) => {
    expect(isAvailabilityPayload({ event })).toBe(false);
  });

  it('narrows to the availability union', () => {
    const payload: { event: string } = unlisted;
    if (isAvailabilityPayload(payload)) {
      expectTypeOf(payload).toEqualTypeOf<AppAvailabilityPayload>();
    }
  });
});
