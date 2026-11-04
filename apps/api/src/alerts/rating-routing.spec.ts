import type { AlertBatchPayload } from '@asobeast/shared';
import {
  listingBatch,
  listingSection,
  ratingDropped,
  reviewSpike,
} from './listing-events.fixture';
import { withRatingDropsAtLeast } from './rating-routing';

describe('withRatingDropsAtLeast', () => {
  const drop2 = ratingDropped({ dropTenths: 2 });
  const drop3 = ratingDropped({ dropTenths: 3, toDate: '2026-11-04' });
  const drop5 = ratingDropped({ dropTenths: 5, toDate: '2026-11-05' });
  const spike = reviewSpike();
  const batch: AlertBatchPayload = listingBatch(
    listingSection({
      ratingDrops: [drop2, drop3, drop5],
      reviewSpikes: [spike],
    }),
    [drop2, spike, drop3, drop5],
  );

  it('removes drops below the threshold from the events and the sections', () => {
    const kept = withRatingDropsAtLeast(batch, 3);

    expect(kept.events).toEqual([spike, drop3, drop5]);
    expect(kept.apps[0].ratingDrops).toEqual([drop3, drop5]);
  });

  it('leaves every other event and array untouched', () => {
    const kept = withRatingDropsAtLeast(batch, 3);

    expect({ ...kept.apps[0], ratingDrops: [] }).toEqual({
      ...batch.apps[0],
      ratingDrops: [],
    });
  });

  it.each([1, null, undefined])('keeps every drop at %p', (tenths) => {
    expect(withRatingDropsAtLeast(batch, tenths)).toEqual(batch);
  });

  it('leaves a section queued before rating drops existed as it was', () => {
    const queued = listingBatch(listingSection(), [spike]);

    expect(withRatingDropsAtLeast(queued, 3)).toEqual(queued);
  });
});
