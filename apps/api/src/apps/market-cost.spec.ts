import { Store } from '@prisma/client';
import { marketDailyRequests, seedCost } from './market-cost';

describe('marketDailyRequests', () => {
  it.each([
    [Store.APP_STORE, 'de', 1, [], { listing: 1, perKeyword: 1 }],
    [Store.APP_STORE, 'pl', 2, [], { listing: 4, perKeyword: 1 }],
    [Store.APP_STORE, 'pl', 2, ['pl'], { listing: 4, perKeyword: 1 }],
    [
      Store.APP_STORE,
      'ch',
      2,
      ['fr', 'it', 'de'],
      { listing: 4, perKeyword: 1 },
    ],
    [Store.GOOGLE_PLAY, 'de', 1, [], { listing: 1, perKeyword: 8 }],
    [Store.GOOGLE_PLAY, 'pl', 2, ['pl'], { listing: 2, perKeyword: 8 }],
  ])(
    'prices a %s market %s for a family of %i shipping %j',
    (store, country, family, shipped, expected) => {
      expect(marketDailyRequests(store, country, family, shipped)).toEqual(
        expected,
      );
    },
  );
});

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
