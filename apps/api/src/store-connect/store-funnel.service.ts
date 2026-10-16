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

const FUNNEL_COLUMNS = {
  date: true,
  country: true,
  sourceType: true,
  pageType: true,
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
    const market = country ? { country } : {};
    const [rows, first] = await Promise.all([
      this.prisma.storeFunnelDay.findMany({
        where: { appId, date: { gte: from }, ...market },
        select: FUNNEL_COLUMNS,
      }),
      this.prisma.storeFunnelDay.aggregate({
        where: { appId },
        _min: { date: true },
      }),
    ]);
    return {
      ...empty,
      connected: true,
      source: app.store === 'APP_STORE' ? 'appStoreConnect' : 'playConsole',
      ...measureStoreFunnel({
        rows: rows.map((row): FunnelDayRow => ({
          ...row,
          date: toDateKey(row.date),
        })),
        days,
        today,
        store: app.store,
        firstDate: first._min.date ? toDateKey(first._min.date) : null,
      }),
    };
  }

  private async connected(appId: string, store: Store): Promise<boolean> {
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
