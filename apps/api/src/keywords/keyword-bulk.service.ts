import { Injectable } from '@nestjs/common';
import {
  assertStorefront,
  KeywordBulkAction,
  KeywordBulkRequest,
  KeywordBulkResult,
} from '@asobeast/shared';
import { QuotaService } from '../auth/quota.service';
import { PrismaService } from '../prisma/prisma.service';
import { FirstPositionChecks } from './first-position-checks';
import { KeywordTracker } from './keyword-tracker';
import { ensureApp, KeywordApp } from './keywords.support';
import { MarketListingRequests } from './market-listing.requests';

interface TrackedRow {
  keywordId: string;
  active: boolean;
  keyword: { store: KeywordApp['store']; country: string };
}

const idsOf = (rows: readonly TrackedRow[]): string[] =>
  rows.map((row) => row.keywordId);

@Injectable()
export class KeywordBulkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quota: QuotaService,
    private readonly tracker: KeywordTracker,
    private readonly listings: MarketListingRequests,
    private readonly checks: FirstPositionChecks,
  ) {}

  async apply(
    appId: string,
    { action, keywordIds }: KeywordBulkRequest,
  ): Promise<KeywordBulkResult> {
    const app = await ensureApp(this.prisma, appId);
    const requested = [...new Set(keywordIds)];
    const tracked = await this.prisma.trackedKeyword.findMany({
      where: { appId, keywordId: { in: requested } },
      select: {
        keywordId: true,
        active: true,
        keyword: { select: { store: true, country: true } },
      },
    });
    const found = new Set(idsOf(tracked));
    const changed = await this.write(app, action, tracked);
    return {
      action,
      requested: requested.length,
      changed,
      unchanged: tracked.length - changed,
      missing: requested.filter((keywordId) => !found.has(keywordId)),
    };
  }

  private write(
    app: KeywordApp,
    action: KeywordBulkAction,
    tracked: readonly TrackedRow[],
  ): Promise<number> {
    if (action === 'pause') return this.pause(app.id, tracked);
    if (action === 'untrack') return this.untrack(app.id, tracked);
    return this.resume(app, tracked);
  }

  private async pause(
    appId: string,
    tracked: readonly TrackedRow[],
  ): Promise<number> {
    const { count } = await this.prisma.trackedKeyword.updateMany({
      where: { appId, active: true, keywordId: { in: idsOf(tracked) } },
      data: { active: false },
    });
    return count;
  }

  private async untrack(
    appId: string,
    tracked: readonly TrackedRow[],
  ): Promise<number> {
    const { count } = await this.prisma.trackedKeyword.deleteMany({
      where: { appId, keywordId: { in: idsOf(tracked) } },
    });
    return count;
  }

  private async resume(
    app: KeywordApp,
    tracked: readonly TrackedRow[],
  ): Promise<number> {
    const paused = tracked.filter((row) => !row.active);
    if (paused.length === 0) return 0;
    for (const { keyword } of paused) {
      assertStorefront(keyword.store, keyword.country);
    }
    const keywordIds = idsOf(paused);
    const { count } = await this.quota.admitKeywordMarkets(async (tx) => {
      const resumed = await tx.trackedKeyword.updateMany({
        where: { appId: app.id, active: false, keywordId: { in: keywordIds } },
        data: { active: true },
      });
      await this.tracker.claimForManual(tx, app.id, keywordIds);
      return resumed;
    });
    await this.checks.schedule(app.id, keywordIds);
    for (const market of new Set(
      paused.map(({ keyword }) => keyword.country),
    )) {
      await this.listings.request(app, market);
    }
    return count;
  }
}
