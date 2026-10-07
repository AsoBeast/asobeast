import {
  eventsIn,
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

  it('filters the home listing on a null country', () => {
    expect(listingIn('us', 'us')).toEqual(HOME_LISTING);
    expect(HOME_LISTING).toEqual({ country: null });
  });

  it('filters another market on its own code', () => {
    expect(listingIn('us', 'de')).toEqual({ country: 'de' });
  });

  it('filters change events the same way', () => {
    expect(eventsIn('us', 'us')).toEqual(HOME_EVENTS);
    expect(eventsIn('us', 'de')).toEqual({ country: 'de' });
  });

  it('names a read of every market as a filter that restricts nothing', () => {
    expect(EVERY_LISTING).toEqual({});
  });

  it('takes the newest listing of a market first', () => {
    expect(latestListingIn('us', 'de')).toEqual({
      where: { country: 'de' },
      orderBy: { capturedAt: 'desc' },
      take: 1,
    });
    expect(latestListingIn('us', 'us')).toEqual(LATEST_HOME_LISTING);
  });
});
