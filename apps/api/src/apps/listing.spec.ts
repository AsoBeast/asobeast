import {
  eventsIn,
  eventsOfMarket,
  EVERY_LISTING,
  HOME_EVENTS,
  HOME_LISTING,
  LATEST_HOME_LISTING,
  latestListingIn,
  listingIn,
  listingMarket,
  storedMarket,
} from './listing';

describe('listing market', () => {
  it('stores the home storefront as null', () => {
    expect(storedMarket('us', 'us')).toBeNull();
  });

  it('stores any other storefront as itself', () => {
    expect(storedMarket('us', 'de')).toBe('de');
  });

  it('reads a null market as the home storefront', () => {
    expect(listingMarket('us', null)).toBe('us');
  });

  it('reads a stored market as itself', () => {
    expect(listingMarket('us', 'de')).toBe('de');
  });

  it('filters the home listing on a null country and the default localization', () => {
    expect(listingIn('us', 'us')).toEqual(HOME_LISTING);
    expect(HOME_LISTING).toEqual({ country: null, localization: null });
  });

  it('filters another market on its own code and the default localization', () => {
    expect(listingIn('us', 'de')).toEqual({
      country: 'de',
      localization: null,
    });
  });

  it('filters a localization of a market on its tag', () => {
    expect(listingIn('us', 'pl', 'pl')).toEqual({
      country: 'pl',
      localization: 'pl',
    });
    expect(listingIn('pl', 'pl', 'pl')).toEqual({
      country: null,
      localization: 'pl',
    });
  });

  it('filters change events the same way', () => {
    expect(eventsIn('us', 'us')).toEqual(HOME_EVENTS);
    expect(HOME_EVENTS).toEqual({ country: null, localization: null });
    expect(eventsIn('us', 'de')).toEqual({ country: 'de', localization: null });
    expect(eventsIn('us', 'pl', 'pl')).toEqual({
      country: 'pl',
      localization: 'pl',
    });
  });

  it('filters change events of every localization of a market', () => {
    expect(eventsOfMarket('us', 'pl')).toEqual({ country: 'pl' });
    expect(eventsOfMarket('us', 'us')).toEqual({ country: null });
  });

  it('names a read of every market as a filter that restricts nothing', () => {
    expect(EVERY_LISTING).toEqual({});
  });

  it('takes the newest listing of a market first', () => {
    expect(latestListingIn('us', 'de')).toEqual({
      where: { country: 'de', localization: null },
      orderBy: { capturedAt: 'desc' },
      take: 1,
    });
    expect(latestListingIn('us', 'us')).toEqual(LATEST_HOME_LISTING);
    expect(latestListingIn('us', 'pl', 'pl').where).toEqual({
      country: 'pl',
      localization: 'pl',
    });
  });
});
