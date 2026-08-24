import { Store } from '@prisma/client';
import { AppStoreLib } from './app-store.lib';
import { AppStoreProvider } from './app-store.provider';
import { GooglePlayLib } from './google-play.lib';
import { GooglePlayProvider } from './google-play.provider';
import { StoreProviderRegistry } from './store-provider.registry';

const stubLib: AppStoreLib = {
  app: jest.fn(),
  search: jest.fn(),
  suggest: jest.fn(),
  similar: jest.fn(),
};

const stubGplayLib: GooglePlayLib = {
  app: jest.fn(),
  search: jest.fn(),
  suggest: jest.fn(),
  similar: jest.fn(),
  list: jest.fn(),
  reviews: jest.fn(),
};

describe('StoreProviderRegistry', () => {
  const registry = new StoreProviderRegistry(
    new AppStoreProvider(stubLib),
    new GooglePlayProvider(stubGplayLib),
  );

  it('returns the App Store provider for APP_STORE', () => {
    expect(registry.get(Store.APP_STORE)).toBeInstanceOf(AppStoreProvider);
  });

  it('returns the Google Play provider for GOOGLE_PLAY', () => {
    expect(registry.get(Store.GOOGLE_PLAY)).toBeInstanceOf(GooglePlayProvider);
  });
});
