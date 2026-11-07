import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  isCheckFresh,
  KeywordDiscoveryTrackResult,
  RANK_DEPTH,
  utcDayOf,
} from '@asobeast/shared';
import { QuotaExceededError } from '../auth/quota.errors';
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

type Admissible = (
  tx: Prisma.TransactionClient,
  chosen: TrackRow[],
) => Promise<TrackRow[]>;

const NOTHING_TRACKED: KeywordDiscoveryTrackResult = { tracked: 0, skipped: 0 };

const utcDate = (day: string): Date => new Date(`${day}T00:00:00.000Z`);

const hasKnownPosition =
  (today: string) =>
  (row: TrackRow): row is KnownPosition =>
    row.depth !== null &&
    (row.position !== null || row.depth >= RANK_DEPTH) &&
    row.checkedOn !== null &&
    isCheckFresh(row.checkedOn, today);

@Injectable()
export class DiscoveryTracker {
  private readonly logger = new Logger(DiscoveryTracker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly quota: QuotaService,
    private readonly tracker: KeywordTracker,
    private readonly checks: FirstPositionChecks,
    private readonly listings: MarketListingRequests,
  ) {}

  trackRows(
    app: KeywordApp,
    rows: readonly TrackRow[],
    today = utcDayOf(new Date()),
  ): Promise<KeywordDiscoveryTrackResult> {
    return this.track(app, rows, today, (_, chosen) => Promise.resolve(chosen));
  }

  async unfit(app: KeywordApp, ranked: readonly TrackRow[]): Promise<number> {
    if (ranked.length === 0) return 0;
    const [tracking, room] = await Promise.all([
      loadTrackingStates(this.prisma, app, ranked),
      this.room(),
    ]);
    return planDiscoveryTrack(ranked, tracking, room).skipped;
  }

  async autoTrack(
    app: KeywordApp,
    rows: readonly TrackRow[],
    today = utcDayOf(new Date()),
  ): Promise<void> {
    try {
      await this.track(app, rows, today, (tx, chosen) =>
        this.stillAutoTracked(tx, app, chosen),
      );
    } catch (error: unknown) {
      if (!(error instanceof QuotaExceededError)) throw error;
      this.logger.log(
        `kept ${rows.length} ranked discoveries of ${app.id} as discoveries, because the plan had no keyword room left: ${error.message}`,
      );
    }
  }

  private async track(
    app: KeywordApp,
    rows: readonly TrackRow[],
    today: string,
    admissible: Admissible,
  ): Promise<KeywordDiscoveryTrackResult> {
    if (rows.length === 0) return NOTHING_TRACKED;
    const tracking = await loadTrackingStates(this.prisma, app, rows);
    const { chosen, skipped } = planDiscoveryTrack(
      rows,
      tracking,
      await this.room(),
    );
    if (chosen.length === 0) return { tracked: 0, skipped };
    const { count, admitted } = await this.quota.admitKeywordMarkets(
      async (tx) => {
        const admitted = await admissible(tx, chosen);
        if (admitted.length === 0) return { count: 0, admitted };
        const created = await tx.trackedKeyword.createMany({
          data: admitted.map(({ keywordId, source }) => ({
            appId: app.id,
            keywordId,
            source: keywordSourceOf[source],
            active: true,
          })),
          skipDuplicates: true,
        });
        if (created.count > 0) {
          await this.recordKnownPositions(
            tx,
            app,
            admitted.filter(hasKnownPosition(today)),
          );
        }
        return { count: created.count, admitted };
      },
    );
    if (count === 0) return { tracked: 0, skipped };
    await this.scheduleFollowUps(
      app,
      admitted,
      admitted.filter(hasKnownPosition(today)),
    );
    return { tracked: count, skipped };
  }

  private async stillAutoTracked(
    tx: Prisma.TransactionClient,
    app: KeywordApp,
    rows: readonly TrackRow[],
  ): Promise<TrackRow[]> {
    const eligible = await tx.keywordDiscovery.findMany({
      where: {
        appId: app.id,
        keywordId: { in: rows.map(({ keywordId }) => keywordId) },
        dismissedAt: null,
        app: { autoTrackRanked: true },
      },
      select: { keywordId: true },
    });
    const ids = new Set(eligible.map(({ keywordId }) => keywordId));
    return rows.filter(({ keywordId }) => ids.has(keywordId));
  }

  private async recordKnownPositions(
    tx: Prisma.TransactionClient,
    app: KeywordApp,
    rows: readonly KnownPosition[],
  ): Promise<void> {
    if (rows.length === 0) return;
    await tx.keywordRanking.createMany({
      data: rows.map(({ keywordId, checkedOn, position, depth }) => ({
        appId: app.id,
        workspaceId: app.workspaceId,
        keywordId,
        date: utcDate(checkedOn),
        position,
        depth,
      })),
      skipDuplicates: true,
    });
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
