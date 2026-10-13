import { Store } from '@prisma/client';
import { localizationReads } from './localization-reads';

const NOTHING_SHIPPED = new Map<string, string[]>();

describe('localizationReads', () => {
  it('counts one read per native localization of each app store listing target', () => {
    expect(
      localizationReads(
        [
          { id: 'a', store: Store.APP_STORE, country: 'pl' },
          { id: 'a', store: Store.APP_STORE, country: 'be' },
          { id: 'a', store: Store.APP_STORE, country: 'in' },
        ],
        NOTHING_SHIPPED,
      ),
    ).toBe(1 + 2 + 11);
  });

  it('counts nothing for a native default storefront, the united states or google play', () => {
    expect(
      localizationReads(
        [
          { id: 'a', store: Store.APP_STORE, country: 'de' },
          { id: 'a', store: Store.APP_STORE, country: 'us' },
          { id: 'a', store: Store.GOOGLE_PLAY, country: 'pl' },
        ],
        NOTHING_SHIPPED,
      ),
    ).toBe(0);
  });

  it('counts a shipped localization the storefront reads beside its default', () => {
    const shipped = new Map([['a', ['fr', 'de']]]);

    expect(
      localizationReads(
        [
          { id: 'a', store: Store.APP_STORE, country: 'ch' },
          { id: 'rival', store: Store.APP_STORE, country: 'ch' },
          { id: 'a', store: Store.GOOGLE_PLAY, country: 'ch' },
        ],
        shipped,
      ),
    ).toBe(1);
  });
});
