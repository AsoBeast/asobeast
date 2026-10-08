import { Store } from '@prisma/client';
import { localizationReads } from './localization-reads';

describe('localizationReads', () => {
  it('counts one read per native localization of each app store listing target', () => {
    expect(
      localizationReads([
        { store: Store.APP_STORE, country: 'pl' },
        { store: Store.APP_STORE, country: 'be' },
        { store: Store.APP_STORE, country: 'in' },
      ]),
    ).toBe(1 + 2 + 11);
  });

  it('counts nothing for a native default storefront, the united states or google play', () => {
    expect(
      localizationReads([
        { store: Store.APP_STORE, country: 'de' },
        { store: Store.APP_STORE, country: 'us' },
        { store: Store.GOOGLE_PLAY, country: 'pl' },
      ]),
    ).toBe(0);
  });
});
