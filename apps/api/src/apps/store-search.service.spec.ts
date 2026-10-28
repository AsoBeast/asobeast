import { Store, UnknownStorefrontError } from '@asobeast/shared';
import { ProxyEgress } from '../store-providers/egress/proxy-egress.service';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { SearchItem, StoreProvider } from '../store-providers/types';
import {
  StoreSearchService,
  toStoreSearchResult,
} from './store-search.service';

const ITEMS: SearchItem[] = [
  { storeAppId: '1', title: 'One', iconUrl: 'https://icon/1.jpg' },
  { storeAppId: '2', title: 'Two' },
  { storeAppId: '3', title: 'Three' },
];

const through = jest.fn(
  (_store: Store, _country: string, work: () => Promise<unknown>) => work(),
);

function serviceWith(search: jest.Mock) {
  const registry = {
    get: () => ({ search }) as unknown as StoreProvider,
  } as unknown as StoreProviderRegistry;
  return new StoreSearchService(registry, {
    through,
  } as unknown as ProxyEgress);
}

const QUERY = {
  store: 'APP_STORE' as const,
  country: 'us',
  q: 'focus',
  limit: 2,
};

describe('toStoreSearchResult', () => {
  it('answers null for every detail the store left out', () => {
    expect(toStoreSearchResult({ storeAppId: '9', title: 'Bare' })).toEqual({
      storeAppId: '9',
      title: 'Bare',
      developer: null,
      ratingAvg: null,
      ratingCount: null,
      iconUrl: null,
    });
  });

  it('keeps every detail the store sent', () => {
    expect(
      toStoreSearchResult({
        storeAppId: '9',
        title: 'Full',
        developer: 'Acme',
        ratingAvg: 4.5,
        ratingCount: 10,
        iconUrl: 'https://icon/9.jpg',
        genreId: '6007',
      }),
    ).toEqual({
      storeAppId: '9',
      title: 'Full',
      developer: 'Acme',
      ratingAvg: 4.5,
      ratingCount: 10,
      iconUrl: 'https://icon/9.jpg',
    });
  });
});

describe('StoreSearchService', () => {
  it('spends before it reaches the store and answers at most the limit', async () => {
    const order: string[] = [];
    const search = jest.fn(() => {
      order.push('search');
      return Promise.resolve(ITEMS);
    });
    const spend = jest.fn(() => {
      order.push('spend');
      return Promise.resolve();
    });

    const results = await serviceWith(search).search(QUERY, spend);

    expect(order).toEqual(['spend', 'search']);
    expect(search).toHaveBeenCalledWith('focus', 'us', 2);
    expect(results.map((result) => result.storeAppId)).toEqual(['1', '2']);
  });

  it('takes any free endpoint rather than wait for one in the storefront', async () => {
    await serviceWith(jest.fn().mockResolvedValue(ITEMS)).search(QUERY);

    expect(through).toHaveBeenCalledWith(
      'APP_STORE',
      'us',
      expect.any(Function),
      { waitForLocal: false },
    );
  });

  it('refuses an unknown storefront before it spends', async () => {
    const search = jest.fn();
    const spend = jest.fn();

    await expect(
      serviceWith(search).search(
        { ...QUERY, store: 'GOOGLE_PLAY', country: 'pw' },
        spend,
      ),
    ).rejects.toBeInstanceOf(UnknownStorefrontError);
    expect(spend).not.toHaveBeenCalled();
    expect(search).not.toHaveBeenCalled();
  });

  it('does not reach the store when the spend is refused', async () => {
    const search = jest.fn();
    const spend = jest.fn(() => Promise.reject(new Error('spent')));

    await expect(serviceWith(search).search(QUERY, spend)).rejects.toThrow(
      'spent',
    );
    expect(search).not.toHaveBeenCalled();
  });
});
