import { RANK_DEPTH, type Store } from '@asobeast/shared';

export const storeSearchRequest = (store: Store, limit: number): number =>
  store === 'APP_STORE' ? RANK_DEPTH : limit;
