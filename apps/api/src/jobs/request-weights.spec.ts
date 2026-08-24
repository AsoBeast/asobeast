import {
  APP_STORE_REQUESTS,
  DAILY_WORK,
  GOOGLE_PLAY_REQUESTS,
  requestsFor,
  requestsPerJob,
} from './request-weights';

describe('request weights', () => {
  it('charges one request for every apple job, which fetches once', () => {
    expect(Object.values(APP_STORE_REQUESTS)).toEqual([1, 1, 1, 1]);
  });

  it('charges a play search for the pages it walks to reach the depth', () => {
    expect(GOOGLE_PLAY_REQUESTS.keywords).toBe(8);
    expect(GOOGLE_PLAY_REQUESTS.categories).toBe(8);
  });

  it('charges a play detail fetch the single request it makes', () => {
    expect(requestsPerJob('GOOGLE_PLAY', 'apps')).toBe(1);
    expect(requestsPerJob('GOOGLE_PLAY', 'reviews')).toBe(1);
  });

  it('never prices a job below one request', () => {
    for (const work of DAILY_WORK) {
      expect(requestsPerJob('APP_STORE', work)).toBeGreaterThanOrEqual(1);
      expect(requestsPerJob('GOOGLE_PLAY', work)).toBeGreaterThanOrEqual(1);
    }
  });

  it('costs nothing for a store with no targets', () => {
    expect(
      requestsFor('GOOGLE_PLAY', {
        apps: 0,
        keywords: 0,
        categories: 0,
        reviews: 0,
      }),
    ).toBe(0);
  });

  it('adds every stage into one store total', () => {
    expect(
      requestsFor('GOOGLE_PLAY', {
        apps: 2,
        keywords: 3,
        categories: 1,
        reviews: 4,
      }),
    ).toBe(2 + 24 + 8 + 4);
  });
});
