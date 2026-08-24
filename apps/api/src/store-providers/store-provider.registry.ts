import { Injectable } from '@nestjs/common';
import { Store } from '@prisma/client';
import { AppStoreProvider } from './app-store.provider';
import { StoreNotSupportedError } from './errors';
import { GooglePlayProvider } from './google-play.provider';
import { StoreProvider } from './types';

@Injectable()
export class StoreProviderRegistry {
  private readonly providers: Map<Store, StoreProvider>;

  constructor(appStore: AppStoreProvider, googlePlay: GooglePlayProvider) {
    this.providers = new Map<Store, StoreProvider>([
      [appStore.store, appStore],
      [googlePlay.store, googlePlay],
    ]);
  }

  get(store: Store): StoreProvider {
    const provider = this.providers.get(store);
    if (!provider) {
      throw new StoreNotSupportedError(store);
    }
    return provider;
  }
}
