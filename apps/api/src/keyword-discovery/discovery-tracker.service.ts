import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  isCheckFresh,
  KeywordDiscoveryTrackResult,
  utcDayOf,
} from '@asobeast/shared';
import { QuotaService } from '../auth/quota.service';
import { FirstPositionChecks } from '../keywords/first-position-checks';
import { KeywordTracker } from '../keywords/keyword-tracker';
import { loadTrackingStates } from '../keywords/keyword-tracking-state';
import { KeywordApp } from '../keywords/keywords.support';
import { MarketListingRequests } from '../keywords/market-listing.requests';
import { PrismaService } from '../prisma/prisma.service';
import { keywordSourceOf } from './discovery-pool';
import { planDiscoveryTrack, TrackRow } from './discovery-track-plan';

type KnownPosition = TrackRow & { depth: number; checkedOn: string };

const NOTHING_TRACKED: KeywordDiscoveryTrackResult = { tracked: 0, skipped: 0 };

const utcDate = (day: string): Date => new Date(`${day}T00:00:00.000Z`);

const hasKnownPosition =
  (today: string) =>
  (row: TrackRow): row is KnownPosition =>
    row.depth !== null &&
    row.checkedOn !== null &&
    isCheckFresh(row.checkedOn, today);

@Injectable()
export class DiscoveryTracker {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quota: QuotaService,
    private readonly tracker: KeywordTracker,
    private readonly checks: FirstPositionChecks,
    private readonly listings: MarketListingRequests,
  ) {}

  async trackRows(
    app: KeywordApp,
    rows: readonly TrackRow[],
    today = utcDayOf(new Date()),
  ): Promise<KeywordDiscoveryTrackResult> {
    if (rows.length === 0) return NOTHING_TRACKED;
    const tracking = await loadTrackingStates(this.prisma, app, rows);
    const { chosen, skipped } = planDiscoveryTrack(
      rows,
      tracking,
      await this.room(),
    );
    if (chosen.length === 0) return { tracked: 0, skipped };
    const known = chosen.filter(hasKnownPosition(today));
    const tracked = await this.quota.admitKeywordMarkets(async (tx) => {
      const { count } = await tx.trackedKeyword.createMany({
        data: chosen.map(({ keywordId, source }) => ({
          appId: app.id,
          keywordId,
          source: keywordSourceOf[source],
          active: true,
        })),
        skipDuplicates: true,
      });
      if (count > 0) await this.recordKnownPositions(tx, app, known);
      return count;
    });
    if (tracked === 0) return { tracked: 0, skipped };
    await this.scheduleFollowUps(app, chosen, known);
    return { tracked, skipped };
  }

  private async recordKnownPositions(
    tx: Prisma.TransactionClient,
    app: KeywordApp,
    rows: readonly KnownPosition[],
  ): Promise<void> {
    for (const { keywordId, checkedOn, position, depth } of rows) {
      const date = utcDate(checkedOn);
      await tx.keywordRanking.upsert({
        where: { appId_keywordId_date: { appId: app.id, keywordId, date } },
        create: {
          appId: app.id,
          workspaceId: app.workspaceId,
          keywordId,
          date,
          position,
          depth,
        },
        update: { position, depth },
      });
    }
  }

  private async scheduleFollowUps(
    app: KeywordApp,
    chosen: readonly TrackRow[],
    known: readonly KnownPosition[],
  ): Promise<void> {
    const positioned = new Set(known.map(({ keywordId }) => keywordId));
    const keywordIds = chosen.map(({ keywordId }) => keywordId);
    await this.checks.schedule(
      app.id,
      keywordIds.filter((keywordId) => !positioned.has(keywordId)),
    );
    await this.tracker.enqueueFirstScores(keywordIds, app);
    const markets = new Set(
      chosen
        .map(({ country }) => country)
        .filter((country) => country !== app.country),
    );
    for (const market of markets) await this.listings.request(app, market);
  }

  private async room(): Promise<number | null> {
    const usage = await this.quota.usage();
    const limit = usage.limits.keywordMarkets;
    return limit === null ? null : Math.max(0, limit - usage.keywordMarkets);
  }
}
