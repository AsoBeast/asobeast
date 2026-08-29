import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUES } from '../jobs/jobs.types';
import { APP_STORE_LIB, appStoreLib } from './app-store.lib';
import { AppStoreProvider } from './app-store.provider';
import { PublishedStatusService } from './canary/published-status.service';
import { StoreCanaryService } from './canary/store-canary.service';
import { GOOGLE_PLAY_LIB, googlePlayLib } from './google-play.lib';
import { GooglePlayProvider } from './google-play.provider';
import { StoreProviderRegistry } from './store-provider.registry';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.PIPELINE })],
  providers: [
    { provide: APP_STORE_LIB, useValue: appStoreLib },
    { provide: GOOGLE_PLAY_LIB, useValue: googlePlayLib },
    AppStoreProvider,
    GooglePlayProvider,
    StoreProviderRegistry,
    StoreCanaryService,
    PublishedStatusService,
  ],
  exports: [StoreProviderRegistry, StoreCanaryService, PublishedStatusService],
})
export class StoreProvidersModule {}
