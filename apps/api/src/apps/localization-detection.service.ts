import { Injectable } from '@nestjs/common';
import { Store } from '@prisma/client';
import { DetectLocalizationPayload } from '../jobs/jobs.types';
import { recordAppLocalizations } from '../keywords/app-localization-records';
import { PrismaService } from '../prisma/prisma.service';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { listingIn, NEWEST_FIRST } from './listing';
import { servesLocalization } from './localization-served';

@Injectable()
export class LocalizationDetection {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: StoreProviderRegistry,
  ) {}

  async probe({
    appId,
    localization,
    country,
  }: DetectLocalizationPayload): Promise<void> {
    const app = await this.prisma.app.findFirst({
      where: { id: appId },
      select: {
        workspaceId: true,
        store: true,
        storeAppId: true,
        country: true,
      },
    });
    if (!app || app.store !== Store.APP_STORE) return;
    const stored = await this.prisma.appSnapshot.findFirst({
      where: { appId, ...listingIn(app.country, country) },
      orderBy: NEWEST_FIRST,
    });
    if (!stored) return;
    const served = await this.registry
      .get(app.store)
      .getApp(app.storeAppId, country, localization);
    if (!servesLocalization(app.store, stored, served)) return;
    await recordAppLocalizations(this.prisma, [
      {
        appId,
        workspaceId: app.workspaceId,
        localization,
        origin: 'detected',
      },
    ]);
  }
}
