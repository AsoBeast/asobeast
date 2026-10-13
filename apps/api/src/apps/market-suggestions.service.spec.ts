import { Store } from '@prisma/client';
import { marketDailyRequests } from './market-suggestions.service';

describe('marketDailyRequests', () => {
  it.each([
    [Store.APP_STORE, 'de', 1, { listing: 1, perKeyword: 1 }],
    [Store.APP_STORE, 'pl', 2, { listing: 4, perKeyword: 1 }],
    [Store.GOOGLE_PLAY, 'de', 1, { listing: 1, perKeyword: 8 }],
    [Store.GOOGLE_PLAY, 'pl', 2, { listing: 2, perKeyword: 8 }],
  ])(
    'prices a %s market %s for a family of %i',
    (store, country, family, expected) => {
      expect(marketDailyRequests(store, country, family)).toEqual(expected);
    },
  );
});
