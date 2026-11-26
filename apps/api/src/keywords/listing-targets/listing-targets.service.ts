import { BadRequestException, Injectable } from '@nestjs/common';
import { Store } from '@prisma/client';
import { AppStoreLocalization, ListingTargetsResult } from '@asobeast/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { loadAppMarkets } from '../app-markets';
import { KeywordsService } from '../keywords.service';
import {
  COMPETITOR_HAS_NO_LOCALIZATIONS,
  ensurePrimaryApp,
  KeywordApp,
} from '../keywords.support';
import { readersOf } from '../localization-markets';
import { listingTargetsOf } from './listing-targets';

export const TARGETS_ON_APP_STORE_ONLY =
  'Target keywords are picked per App Store localization; Google Play has no localizations here';

@Injectable()
export class ListingTargetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly keywords: KeywordsService,
  ) {}

  async read(
    appId: string,
    localization: AppStoreLocalization,
  ): Promise<ListingTargetsResult> {
    const app = await this.targetApp(appId);
    const [readers, stored, tracked] = await Promise.all([
      this.readers(app, localization),
      this.prisma.listingTarget.findUnique({
        where: { appId_localization: { appId, localization } },
        select: { slots: true, updatedAt: true },
      }),
      this.keywords.listTracked(appId, undefined, undefined, {
        brandFacts: true,
      }),
    ]);
    return listingTargetsOf({
      appId,
      localization,
      readers,
      stored,
      tracked,
    });
  }

  private async targetApp(appId: string): Promise<KeywordApp> {
    const app = await ensurePrimaryApp(
      this.prisma,
      appId,
      COMPETITOR_HAS_NO_LOCALIZATIONS,
    );
    if (app.store !== Store.APP_STORE) {
      throw new BadRequestException(TARGETS_ON_APP_STORE_ONLY);
    }
    return app;
  }

  private async readers(
    app: KeywordApp,
    localization: AppStoreLocalization,
  ): Promise<string[]> {
    const markets = await loadAppMarkets(this.prisma, app);
    return readersOf(localization, markets, app.country).map(
      ({ country }) => country,
    );
  }
}
