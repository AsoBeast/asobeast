import { ratingDroppedPayload } from './listing-alert-payloads';
import type { RatingDrop } from './rating-drop';

const drop: RatingDrop = {
  from: 4.66,
  to: 4.44,
  fromCount: 1200,
  toCount: 1260,
  fromDate: '2026-10-27',
  toDate: '2026-11-03',
  dropTenths: 2,
  version: '2.4',
};

describe('ratingDroppedPayload', () => {
  it('names the app, its home storefront, the drop and the action', () => {
    expect(
      ratingDroppedPayload(
        { id: 'app_1', name: 'My App', country: 'us' },
        drop,
        'act_1',
        new Date('2026-11-03T03:10:00.000Z'),
      ),
    ).toEqual({
      event: 'rating.dropped',
      occurredAt: '2026-11-03T03:10:00.000Z',
      app: { id: 'app_1', name: 'My App' },
      country: 'us',
      ...drop,
      actionId: 'act_1',
    });
  });
});
