import { Injectable } from '@nestjs/common';
import { toDateKey } from '../analytics/analytics.support';
import { PrismaService } from '../prisma/prisma.service';
import {
  completeThrough,
  countsOf,
  finalThrough,
  marketFunnelScope,
  shiftDate,
  type FunnelDayRow,
} from '../store-connect/store-funnel';
import { StoreFunnelService } from '../store-connect/store-funnel.service';

export interface ActionFunnelDay {
  date: string;
  pageViews: number;
  gets: number;
  uniqueImpressions: number;
}

export interface ActionPageDay {
  date: string;
  pageTitle: string;
  pageViews: number;
  uniqueImpressions: number;
  gets: number;
}

export interface ActionFunnel {
  reporting: boolean;
  completeThrough: string;
  days: ActionFunnelDay[];
  pages: ActionPageDay[];
}

interface FunnelApp {
  id: string;
  store: 'APP_STORE' | 'GOOGLE_PLAY';
  country: string;
}

const dateOf = (key: string): Date => new Date(`${key}T00:00:00.000Z`);

export const emptyFunnel = (now: Date): ActionFunnel => ({
  reporting: false,
  completeThrough: completeThrough(now),
  days: [],
  pages: [],
});

function dailyFunnel(rows: FunnelDayRow[], app: FunnelApp): ActionFunnelDay[] {
  const byDate = new Map<string, FunnelDayRow[]>();
  for (const row of rows) {
    const day = byDate.get(row.date);
    if (day) day.push(row);
    else byDate.set(row.date, [row]);
  }
  return [...byDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, day]) => {
      const counts = countsOf(day, app.store);
      return {
        date,
        pageViews: counts.pageViews,
        gets: counts.gets,
        uniqueImpressions: counts.uniqueImpressions ?? counts.pageViews,
      };
    });
}

function groupByApp<T extends { appId: string }>(rows: T[]): Map<string, T[]> {
  const byApp = new Map<string, T[]>();
  for (const row of rows) {
    const list = byApp.get(row.appId);
    if (list) list.push(row);
    else byApp.set(row.appId, [row]);
  }
  return byApp;
}

@Injectable()
export class ActionFunnelReader {
  constructor(
    private readonly prisma: PrismaService,
    private readonly funnel: StoreFunnelService,
  ) {}

  async forApps(
    apps: FunnelApp[],
    now: Date,
    windowDays: number,
  ): Promise<Map<string, ActionFunnel>> {
    const connected = await this.funnel.connectedApps(
      apps.map((app) => app.id),
    );
    const funnels = new Map<string, ActionFunnel>();
    if (apps.length === 0) return funnels;
    const windows = apps.map((app) => {
      const through = finalThrough(now, app.store);
      return {
        app,
        through,
        where: {
          appId: app.id,
          ...marketFunnelScope(app.store, app.country, app.country),
          date: {
            gte: dateOf(shiftDate(through, 1 - windowDays)),
            lte: dateOf(through),
          },
        },
      };
    });
    const scopes = windows.map((window) => window.where);
    const [days, pages] = await Promise.all([
      this.prisma.storeFunnelDay.findMany({
        where: { OR: scopes },
        select: {
          appId: true,
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
        },
      }),
      this.prisma.storeFunnelPageDay.findMany({
        where: { OR: scopes },
        select: {
          appId: true,
          date: true,
          pageTitle: true,
          pageViews: true,
          uniqueImpressions: true,
          gets: true,
        },
        orderBy: { date: 'asc' },
      }),
    ]);
    const daysOf = groupByApp(days);
    const pagesOf = groupByApp(pages);
    for (const { app, through } of windows) {
      funnels.set(app.id, {
        reporting: connected.has(app.id),
        completeThrough: through,
        days: dailyFunnel(
          (daysOf.get(app.id) ?? []).map((row) => ({
            ...row,
            date: toDateKey(row.date),
          })),
          app,
        ),
        pages: (pagesOf.get(app.id) ?? []).map((row) => ({
          date: toDateKey(row.date),
          pageTitle: row.pageTitle,
          pageViews: row.pageViews,
          uniqueImpressions: row.uniqueImpressions,
          gets: row.gets,
        })),
      });
    }
    return funnels;
  }
}
