import { Module } from '@nestjs/common';
import { APP_STORE_LIB, appStoreLib } from './app-store.lib';
import { AppStoreProvider } from './app-store.provider';
import { PublishedStatusService } from './canary/published-status.service';
import { StoreCanaryService } from './canary/store-canary.service';
import { GOOGLE_PLAY_LIB, googlePlayLib } from './google-play.lib';
import { GooglePlayProvider } from './google-play.provider';
import { IconImageSource } from './icon-image';
import { ScreenshotImageSource } from './screenshot-image.source';
import { StoreProviderRegistry } from './store-provider.registry';

@Module({
  providers: [
    { provide: APP_STORE_LIB, useValue: appStoreLib },
    { provide: GOOGLE_PLAY_LIB, useValue: googlePlayLib },
    AppStoreProvider,
    GooglePlayProvider,
    StoreProviderRegistry,
    StoreCanaryService,
    PublishedStatusService,
    ScreenshotImageSource,
    IconImageSource,
  ],
  exports: [
    StoreProviderRegistry,
    StoreCanaryService,
    PublishedStatusService,
    ScreenshotImageSource,
    IconImageSource,
  ],
})
export class StoreProvidersModule {}
