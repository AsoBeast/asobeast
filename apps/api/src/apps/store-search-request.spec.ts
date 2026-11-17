import { RANK_DEPTH } from '@asobeast/shared';
import { storeSearchRequest } from './store-search-request';

describe('storeSearchRequest', () => {
  it('asks the app store for what a rank check asks, whatever the limit', () => {
    expect(storeSearchRequest('APP_STORE', 1)).toBe(RANK_DEPTH);
    expect(storeSearchRequest('APP_STORE', 25)).toBe(RANK_DEPTH);
  });

  it('asks google play for exactly the limit', () => {
    expect(storeSearchRequest('GOOGLE_PLAY', 1)).toBe(1);
    expect(storeSearchRequest('GOOGLE_PLAY', 25)).toBe(25);
  });
});
