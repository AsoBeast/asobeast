import { Store } from '@prisma/client';
import type {
  NormalizedApp,
  StoreProvider,
} from '../../src/store-providers/types';

export const RIVAL_URL = 'https://apps.apple.com/us/app/rival/id9876543210';

const FIXTURE: NormalizedApp = {
  store: Store.APP_STORE,
  storeAppId: '9876543210',
  title: 'Rival',
  description: 'Fixture description',
  raw: { source: 'fixture' },
  searchable: true,
};

export class FakeRegistry {
  get(store: Store): StoreProvider {
    return {
      store,
      getApp: (storeAppId: string) =>
        Promise.resolve({ ...FIXTURE, storeAppId }),
      search: () => Promise.resolve([]),
      suggest: () => Promise.resolve([]),
      similar: () => Promise.resolve([]),
      availability: (_id: string, countries: string[]) =>
        Promise.resolve(
          countries.map((country) => ({
            country,
            status: 'available' as const,
          })),
        ),
    } as unknown as StoreProvider;
  }
}
