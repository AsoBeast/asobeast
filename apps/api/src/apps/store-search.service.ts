import { Injectable } from '@nestjs/common';
import { assertStorefront, Store, StoreSearchResult } from '@asobeast/shared';
import { ProxyEgress } from '../store-providers/egress/proxy-egress.service';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { SearchItem } from '../store-providers/types';

export interface StoreSearchQuery {
  store: Store;
  country: string;
  q: string;
  limit: number;
}

export function toStoreSearchResult(item: SearchItem): StoreSearchResult {
  return {
    storeAppId: item.storeAppId,
    title: item.title,
    developer: item.developer ?? null,
    ratingAvg: item.ratingAvg ?? null,
    ratingCount: item.ratingCount ?? null,
    iconUrl: item.iconUrl ?? null,
  };
}

@Injectable()
export class StoreSearchService {
  constructor(
    private readonly registry: StoreProviderRegistry,
    private readonly egress: ProxyEgress,
  ) {}

  async search(
    query: StoreSearchQuery,
    spend?: () => Promise<void>,
  ): Promise<StoreSearchResult[]> {
    assertStorefront(query.store, query.country);
    await spend?.();
    const items = await this.egress.through(
      query.store,
      query.country,
      () =>
        this.registry
          .get(query.store)
          .search(query.q, query.country, query.limit),
      { waitForLocal: false },
    );
    return items.slice(0, query.limit).map(toStoreSearchResult);
  }
}
