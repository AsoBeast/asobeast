import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, Store } from '@prisma/client';
import {
  AppStoreLocalization,
  KeywordImportRowResult,
  ListingTargetsRequest,
  ListingTargetsResult,
  ListingTargetsSaveResult,
  TargetNotTracked,
  utcDayOf,
} from '@asobeast/shared';
import { WorkspaceContext } from '../../common/tenancy/workspace-context';
import { PrismaService } from '../../prisma/prisma.service';
import { loadAppMarkets } from '../app-markets';
import { serializeKeywordField } from '../keyword-field-writer';
import { KeywordPairTracker } from '../keyword-pair-tracker';
import { KeywordsService } from '../keywords.service';
import {
  COMPETITOR_HAS_NO_LOCALIZATIONS,
  ensurePrimaryApp,
  KeywordApp,
} from '../keywords.support';
import { readersOf } from '../localization-markets';
import { listingTargetsOf, withPlacements } from './listing-targets';
import { placementVerdicts } from './placement';
import {
  normalizeTargetSlots,
  phrasesToTrack,
  targetPairs,
} from './target-slots';

export const TARGETS_ON_APP_STORE_ONLY =
  'Target keywords are picked per App Store localization; Google Play has no localizations here';

const notTrackedOf = (
  results: readonly KeywordImportRowResult[],
): TargetNotTracked[] =>
  results
    .filter(({ status }) => status === 'overQuota')
    .map(({ keyword, country }) => ({
      text: keyword,
      country,
      reason: 'keywordLimit',
    }));

@Injectable()
export class ListingTargetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly keywords: KeywordsService,
    private readonly pairs: KeywordPairTracker,
    private readonly workspace: WorkspaceContext,
  ) {}

  async read(
    appId: string,
    localization: AppStoreLocalization,
  ): Promise<ListingTargetsResult> {
    const app = await this.targetApp(appId);
    return this.result(
      app,
      localization,
      await this.readers(app, localization),
    );
  }

  async save(
    appId: string,
    localization: AppStoreLocalization,
    request: ListingTargetsRequest,
  ): Promise<ListingTargetsSaveResult> {
    const app = await this.targetApp(appId);
    const check = normalizeTargetSlots(request.slots);
    if (!check.ok) {
      throw new BadRequestException(check.message);
    }
    const [readers, stored] = await Promise.all([
      this.readers(app, localization),
      this.prisma.listingTarget.findUnique({
        where: { appId_localization: { appId, localization } },
        select: { slots: true },
      }),
    ]);
    const phrases = phrasesToTrack(
      check.slots,
      stored?.slots ?? [],
      request.trackMissing ?? false,
    );
    const { plan } = await this.pairs.plan(
      app,
      targetPairs(phrases, readers).map(({ text, country }) => ({
        keyword: text,
        country,
      })),
      app.country,
    );
    const tracked = await this.pairs.write(app, plan.additions, (tx) =>
      this.store(tx, appId, localization, check.slots),
    );
    const [result, quota] = await Promise.all([
      this.result(app, localization, readers),
      this.pairs.quotaAfterWrite(),
    ]);
    return {
      ...result,
      tracked,
      notTracked: notTrackedOf(plan.results),
      quota,
    };
  }

  private async store(
    tx: Prisma.TransactionClient,
    appId: string,
    localization: AppStoreLocalization,
    slots: string[],
  ): Promise<void> {
    await serializeKeywordField(tx, appId);
    if (slots.length === 0) {
      await tx.listingTarget.deleteMany({ where: { appId, localization } });
      return;
    }
    await tx.listingTarget.upsert({
      where: { appId_localization: { appId, localization } },
      update: { slots },
      create: {
        appId,
        workspaceId: this.workspace.require('a target keywords save'),
        localization,
        slots,
      },
    });
  }

  private async result(
    app: KeywordApp,
    localization: AppStoreLocalization,
    readers: string[],
  ): Promise<ListingTargetsResult> {
    const [stored, tracked] = await Promise.all([
      this.prisma.listingTarget.findUnique({
        where: { appId_localization: { appId: app.id, localization } },
        select: { slots: true, updatedAt: true },
      }),
      this.keywords.listTracked(app.id, undefined, undefined, {
        brandFacts: true,
      }),
    ]);
    const result = listingTargetsOf({
      appId: app.id,
      localization,
      readers,
      stored,
      tracked,
    });
    return withPlacements(
      result,
      placementVerdicts({
        store: app.store,
        targets: result.slots.filter((slot) => slot !== null),
        candidates: result.candidates,
        today: utcDayOf(Date.now()),
      }),
    );
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
    return readersOf(app, localization, markets).map(({ country }) => country);
  }
}
