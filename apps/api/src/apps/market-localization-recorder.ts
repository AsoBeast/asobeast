import { Injectable, Logger } from '@nestjs/common';
import { Store } from '@prisma/client';
import { recordAppLocalizations } from '../keywords/app-localization-records';
import { PrismaService } from '../prisma/prisma.service';
import { HOME_LISTING, NEWEST_FIRST } from './listing';
import { ComparableListing } from './localization-served';
import {
  ListedApp,
  LocalizedCapture,
} from './localized-listing-capture.service';
import { provenDefaultLocalization } from './market-default-localization';

const reason = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

@Injectable()
export class MarketLocalizationRecorder {
  private readonly logger = new Logger(MarketLocalizationRecorder.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(
    app: ListedApp,
    market: string,
    listing: ComparableListing,
    localized: LocalizedCapture,
  ): Promise<void> {
    if (
      market === app.country ||
      app.isCompetitor ||
      app.store !== Store.APP_STORE ||
      !localized.complete
    ) {
      return;
    }
    try {
      await this.recordProven(app, market, listing, localized.listings);
    } catch (error: unknown) {
      this.logger.warn(
        `could not record the default localization of ${app.id} in ${market}: ${reason(error)}`,
      );
    }
  }

  private async recordProven(
    app: ListedApp,
    market: string,
    listing: ComparableListing,
    others: readonly ComparableListing[],
  ): Promise<void> {
    const homeListing = await this.prisma.appSnapshot.findFirst({
      where: { appId: app.id, ...HOME_LISTING },
      orderBy: NEWEST_FIRST,
    });
    if (!homeListing) return;
    const localization = provenDefaultLocalization({
      home: app.country,
      market,
      homeListing,
      listing,
      others,
    });
    if (!localization) return;
    await recordAppLocalizations(this.prisma, [
      {
        appId: app.id,
        workspaceId: app.workspaceId,
        localization,
        origin: 'detected',
      },
    ]);
  }
}
