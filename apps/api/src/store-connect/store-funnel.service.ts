import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Store } from '@prisma/client';
import type { StoreFunnelReport } from '@asobeast/shared';
import {
  addDays,
  startOfUtcDay,
  toDateKey,
} from '../analytics/analytics.support';
import type { SecretBox } from '../common/crypto/secret-box';
import { PrismaService } from '../prisma/prisma.service';
import { SECRET_BOX } from './secret-box.provider';
import {
  completeThrough,
  FUNNEL_LOOKBACK_DAYS,
  FUNNEL_PAGES_DAYS,
  funnelPages,
  funnelScope,
  measureStoreFunnel,
  shiftDate,
  type FunnelDayRow,
  type PageDayRow,
} from './store-funnel';

const dateOf = (key: string): Date => new Date(`${key}T00:00:00.000Z`);

export interface StoreFunnelQuery {
  country?: string;
  days: number;
}

export interface FunnelRange {
  firstDate: string | null;
  lastDate: string | null;
}

const COUNTERS = {
  impressions: true,
  uniqueImpressions: true,
  pageViews: true,
  uniquePageViews: true,
  gets: true,
  uniqueGets: true,
} as const;

export const reportingRequest = (appIds: string[], store?: Store) => ({
  appId: { in: appIds },
  accessType: 'ONGOING',
  state: 'requested',
  connection: { status: 'active', ...(store ? { store } : {}) },
});

@Injectable()
export class StoreFunnelService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SECRET_BOX) private readonly box: SecretBox | null,
  ) {}

  async report(
    appId: string,
    { country, days }: StoreFunnelQuery,
    now = new Date(),
  ): Promise<StoreFunnelReport> {
    const app = await this.prisma.app.findFirst({
      where: { id: appId },
      select: { id: true, store: true, isCompetitor: true },
    });
    if (!app) throw new NotFoundException(`App ${appId} not found`);
    const empty: StoreFunnelReport = {
      appId,
      store: app.store,
      country: country ?? null,
      connected: false,
      source: null,
      days,
      completeThrough: null,
      points: [],
      windows: [],
    };
    if (app.isCompetitor || !(await this.connected(app.id, app.store))) {
      return empty;
    }
    const today = startOfUtcDay(now);
    const from = addDays(today, 1 - Math.max(days, FUNNEL_LOOKBACK_DAYS));
    const [rows, range, pageRows] = await Promise.all([
      this.rows(app, from, country),
      this.range(appId),
      this.pageRows(appId, today, country),
    ]);
    return {
      ...empty,
      connected: true,
      source: app.store === 'APP_STORE' ? 'appStoreConnect' : 'playConsole',
      ...measureStoreFunnel({
        rows,
        days,
        today,
        store: app.store,
        ...range,
      }),
      ...(pageRows.length > 0 ? { pages: funnelPages(pageRows) } : {}),
    };
  }

  async rows(
    app: { id: string; store: Store },
    from: Date,
    country?: string,
  ): Promise<FunnelDayRow[]> {
    const rows = await this.prisma.storeFunnelDay.groupBy({
      by: ['date', 'sourceType', 'pageType'],
      where: {
        appId: app.id,
        date: { gte: from },
        ...funnelScope(app.store, country),
      },
      _sum: COUNTERS,
    });
    return rows.map((row): FunnelDayRow => ({
      date: toDateKey(row.date),
      country: country ?? null,
      sourceType: row.sourceType,
      pageType: row.pageType,
      impressions: row._sum.impressions ?? 0,
      uniqueImpressions: row._sum.uniqueImpressions ?? 0,
      pageViews: row._sum.pageViews ?? 0,
      uniquePageViews: row._sum.uniquePageViews ?? 0,
      gets: row._sum.gets ?? 0,
      uniqueGets: row._sum.uniqueGets ?? 0,
    }));
  }

  private async pageRows(
    appId: string,
    today: Date,
    country?: string,
  ): Promise<PageDayRow[]> {
    const to = completeThrough(today);
    const rows = await this.prisma.storeFunnelPageDay.findMany({
      where: {
        appId,
        date: {
          gte: dateOf(shiftDate(to, 1 - FUNNEL_PAGES_DAYS)),
          lte: dateOf(to),
        },
        ...(country ? { country } : {}),
      },
      select: {
        date: true,
        pageTitle: true,
        impressions: true,
        uniqueImpressions: true,
        pageViews: true,
        uniquePageViews: true,
        gets: true,
        uniqueGets: true,
      },
    });
    return rows.map((row) => ({ ...row, date: toDateKey(row.date) }));
  }

  async range(appId: string): Promise<FunnelRange> {
    const range = await this.prisma.storeFunnelDay.aggregate({
      where: { appId },
      _min: { date: true },
      _max: { date: true },
    });
    return {
      firstDate: range._min.date ? toDateKey(range._min.date) : null,
      lastDate: range._max.date ? toDateKey(range._max.date) : null,
    };
  }

  async connected(appId: string, store: Store): Promise<boolean> {
    return (await this.connectedApps([appId], store)).has(appId);
  }

  async connectedApps(appIds: string[], store?: Store): Promise<Set<string>> {
    if (!this.box || appIds.length === 0) return new Set();
    const requests = await this.prisma.storeReportRequest.findMany({
      where: reportingRequest(appIds, store),
      select: { appId: true },
    });
    return new Set(requests.map((request) => request.appId));
  }
}
