import { Store } from '@prisma/client';
import { seedCost } from './market-seed.service';

describe('seedCost', () => {
  it.each([
    [Store.APP_STORE, 9, 2, { keywordMarkets: 9, dailyRequests: 11 }],
    [Store.GOOGLE_PLAY, 3, 1, { keywordMarkets: 3, dailyRequests: 25 }],
    [Store.APP_STORE, 0, 0, { keywordMarkets: 0, dailyRequests: 0 }],
  ])(
    'prices %s keywords opening %i markets and %i listing reads',
    (store, opened, listingReads, expected) => {
      expect(seedCost(store, { opened, listingReads })).toEqual({
        store,
        ...expected,
      });
    },
  );
});
