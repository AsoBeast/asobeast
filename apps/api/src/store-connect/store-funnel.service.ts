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
  FUNNEL_LOOKBACK_DAYS,
  measureStoreFunnel,
  type FunnelDayRow,
} from './store-funnel';

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
    const [rows, range] = await Promise.all([
      this.rows(appId, from, country),
      this.range(appId),
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
    };
  }

  async rows(
    appId: string,
    from: Date,
    country?: string,
  ): Promise<FunnelDayRow[]> {
    const rows = await this.prisma.storeFunnelDay.groupBy({
      by: ['date', 'sourceType', 'pageType'],
      where: { appId, date: { gte: from }, ...(country ? { country } : {}) },
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

  async firstDate(appId: string): Promise<string | null> {
    return (await this.range(appId)).firstDate;
  }

  async connected(appId: string, store: Store): Promise<boolean> {
    if (!this.box) return false;
    const request = await this.prisma.storeReportRequest.findFirst({
      where: {
        appId,
        accessType: 'ONGOING',
        state: 'requested',
        connection: { store, status: 'active' },
      },
      select: { id: true },
    });
    return request !== null;
  }
}
