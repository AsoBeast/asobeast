import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { appleAdsEnabled } from '../config/apple-ads-config';
import { Env } from '../config/env';
import { StoreProvidersModule } from '../store-providers/store-providers.module';
import {
  ApplePopularityClient,
  DisabledPopularityClient,
} from './apple-popularity';
import { appleAdsPopularityClient } from './apple-popularity.client';
import { ApplePopularitySync } from './apple-popularity.sync';
import { ScoringService } from './scoring.service';
import { StatsCollectorService } from './stats-collector.service';

function applePopularityClient(
  config: ConfigService<Env, true>,
): ApplePopularityClient {
  const env = {
    APPLE_ADS_CLIENT_ID: config.get('APPLE_ADS_CLIENT_ID', { infer: true }),
    APPLE_ADS_TEAM_ID: config.get('APPLE_ADS_TEAM_ID', { infer: true }),
    APPLE_ADS_KEY_ID: config.get('APPLE_ADS_KEY_ID', { infer: true }),
    APPLE_ADS_PRIVATE_KEY_PATH: config.get('APPLE_ADS_PRIVATE_KEY_PATH', {
      infer: true,
    }),
    APPLE_ADS_AD_ACCOUNT_ID: config.get('APPLE_ADS_AD_ACCOUNT_ID', {
      infer: true,
    }),
  };
  return appleAdsEnabled(env)
    ? appleAdsPopularityClient(env)
    : new DisabledPopularityClient();
}

@Module({
  imports: [StoreProvidersModule],
  providers: [
    StatsCollectorService,
    ScoringService,
    ApplePopularitySync,
    {
      provide: ApplePopularityClient,
      inject: [ConfigService],
      useFactory: applePopularityClient,
    },
  ],
  exports: [
    StatsCollectorService,
    ScoringService,
    ApplePopularityClient,
    ApplePopularitySync,
  ],
})
export class ScoringModule {}
