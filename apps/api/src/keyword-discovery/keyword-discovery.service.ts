import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Store } from '@prisma/client';
import {
  DISCOVERY_CHECKS_PER_RUN,
  DiscoveryState,
  isDiscoverySource,
  KeywordDiscoveryChecks,
  KeywordDiscoveryItem,
  KeywordDiscoveryList,
  utcDayOf,
} from '@asobeast/shared';
import { Env } from '../config/env';
import { nextRun } from '../jobs/daily-schedule';
import { ensurePrimaryApp, KeywordApp } from '../keywords/keywords.support';
import { PrismaService } from '../prisma/prisma.service';
import { appOpportunity } from '../scoring/keyword-opportunity';
import { COMPETITOR_REFUSAL } from './discovery-planner.service';
import { DiscoveryPopularity } from './discovery-popularity.service';
import { keywordSourceOf } from './discovery-pool';
import { weekStartOf } from './discovery-schedule';
import {
  discoveryStateOf,
  isPending,
  pendingWindowStart,
  rankDiscoveries,
} from './discovery-state';
import { DiscoveryTracker } from './discovery-tracker.service';

export interface DiscoveryListQuery {
  country?: string;
  state: DiscoveryState;
  limit: number;
}

type UnrankedItem = Omit<KeywordDiscoveryItem, 'recommended'>;

const dayOf = (date: Date | null): string | null =>
  date === null ? null : utcDayOf(date);

const inState =
  (state: DiscoveryState) =>
  (item: KeywordDiscoveryItem): boolean =>
    state === 'all' || item.state === state;

@Injectable()
export class KeywordDiscoveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly popularity: DiscoveryPopularity,
    private readonly config: ConfigService<Env, true>,
    private readonly tracker: DiscoveryTracker,
  ) {}

  async list(
    appId: string,
    query: DiscoveryListQuery,
    now = new Date(),
  ): Promise<KeywordDiscoveryList> {
    const app = await ensurePrimaryApp(this.prisma, appId, COMPETITOR_REFUSAL);
    const [settings, unranked, checks] = await Promise.all([
      this.prisma.app.findFirst({
        where: { id: appId },
        select: { autoTrackRanked: true },
      }),
      this.openItems(app, query.country),
      this.checks(app, now),
    ]);
    const autoTrackRanked = settings?.autoTrackRanked ?? false;
    const { items, counts } = rankDiscoveries(unranked);
    return {
      items: items.filter(inState(query.state)).slice(0, query.limit),
      counts,
      autoTrackRanked,
      unfit: autoTrackRanked
        ? await this.tracker.unfit(
            app,
            items.filter(({ state }) => state === 'ranked'),
          )
        : 0,
      checks,
    };
  }

  private async openItems(
    app: KeywordApp,
    country: string | undefined,
  ): Promise<UnrankedItem[]> {
    const rows = await this.prisma.keywordDiscovery.findMany({
      where: {
        appId: app.id,
        dismissedAt: null,
        keyword: {
          tracked: { none: { appId: app.id } },
          ...(country ? { country } : {}),
        },
      },
      select: {
        keywordId: true,
        source: true,
        relevance: true,
        position: true,
        depth: true,
        checkedOn: true,
        keyword: {
          select: {
            text: true,
            country: true,
            metrics: {
              orderBy: { date: 'desc' },
              take: 1,
              select: { traffic: true, difficulty: true },
            },
          },
        },
      },
    });
    const listed = await this.listedTraffic(
      app.store,
      rows
        .filter(({ keyword }) => (keyword.metrics[0]?.traffic ?? null) === null)
        .map(({ keyword }) => keyword),
    );
    return rows.flatMap(({ source, keyword, checkedOn, ...row }) => {
      if (!isDiscoverySource(source)) return [];
      const metric = keyword.metrics[0];
      const traffic =
        metric?.traffic ??
        listed.get(keyword.country)?.get(keyword.text) ??
        null;
      const difficulty = metric?.difficulty ?? null;
      const { volume, opportunity } = appOpportunity({
        source: keywordSourceOf[source],
        keywordText: keyword.text,
        snapshotText: '',
        relevanceOverride: row.relevance,
        traffic,
        difficulty,
      });
      return [
        {
          ...row,
          text: keyword.text,
          country: keyword.country,
          source,
          checkedOn: dayOf(checkedOn),
          traffic,
          difficulty,
          volume,
          opportunity,
          state: discoveryStateOf({
            position: row.position,
            relevance: row.relevance,
            opportunity,
          }),
        },
      ];
    });
  }

  private async listedTraffic(
    store: Store,
    keywords: readonly { text: string; country: string }[],
  ): Promise<Map<string, Map<string, number>>> {
    if (store !== Store.APP_STORE) return new Map();
    const countries = [...new Set(keywords.map(({ country }) => country))];
    return new Map(
      await Promise.all(
        countries.map(
          async (country) =>
            [
              country,
              await this.popularity.listedTraffic(
                country,
                keywords
                  .filter((keyword) => keyword.country === country)
                  .map(({ text }) => text),
              ),
            ] as const,
        ),
      ),
    );
  }

  private async checks(
    app: KeywordApp,
    now: Date,
  ): Promise<KeywordDiscoveryChecks> {
    const weekStart = weekStartOf(now);
    const windowStart = pendingWindowStart(now);
    const [queued, newest] = await Promise.all([
      this.prisma.keywordDiscovery.findMany({
        where: {
          appId: app.id,
          queuedAt: { gte: windowStart < weekStart ? windowStart : weekStart },
        },
        select: { queuedAt: true, checkedOn: true, depth: true },
      }),
      this.prisma.keywordDiscovery.aggregate({
        where: { appId: app.id },
        _max: { checkedOn: true },
      }),
    ]);
    const cron = this.config.get('CRON_DISCOVERY', { infer: true });
    return {
      perWeek: DISCOVERY_CHECKS_PER_RUN[app.store],
      usedThisWeek: queued.filter(
        ({ queuedAt }) => queuedAt !== null && queuedAt >= weekStart,
      ).length,
      pending: queued.filter((row) =>
        isPending(
          {
            queuedAt: row.queuedAt,
            checkedOn: dayOf(row.checkedOn),
            depth: row.depth,
          },
          now,
        ),
      ).length,
      checkedAt: dayOf(newest._max.checkedOn),
      nextRunAt: nextRun(cron, now)?.toISOString() ?? null,
    };
  }
}
