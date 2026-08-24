import { Module } from '@nestjs/common';
import { APP_STORE_LIB, appStoreLib } from './app-store.lib';
import { AppStoreProvider } from './app-store.provider';
import { GOOGLE_PLAY_LIB, googlePlayLib } from './google-play.lib';
import { GooglePlayProvider } from './google-play.provider';
import { StoreProviderRegistry } from './store-provider.registry';

@Module({
  providers: [
    { provide: APP_STORE_LIB, useValue: appStoreLib },
    { provide: GOOGLE_PLAY_LIB, useValue: googlePlayLib },
    AppStoreProvider,
    GooglePlayProvider,
    StoreProviderRegistry,
  ],
  exports: [StoreProviderRegistry],
})
export class StoreProvidersModule {}
