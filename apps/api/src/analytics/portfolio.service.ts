import { Injectable } from '@nestjs/common';
import { AppSetup } from '@prisma/client';
import {
  PortfolioApp,
  PortfolioGroup,
  PortfolioSummary,
  setupSummary,
} from '@asobeast/shared';
import { PrismaService } from '../prisma/prisma.service';
import {
  DAY_MS,
  GroupMember,
  groupAggregates,
  groupVisibility,
  groupVisibilityPoints,
  sparklineRows,
  visibilityPoints,
  windowVisibility,
} from './analytics.support';
import { countChangeDays } from './change-days';
import { setupStateOf } from '../apps/apps.mapper';
import { HOME_EVENTS, LATEST_HOME_LISTING } from '../apps/listing';

const CHANGES_WINDOW_DAYS = 7;

@Injectable()
export class PortfolioService {
  constructor(private readonly prisma: PrismaService) {}

  async portfolio(): Promise<PortfolioSummary> {
    const apps = await this.prisma.app.findMany({
      where: { isCompetitor: false },
      select: {
        id: true,
        store: true,
        storeAppId: true,
        country: true,
        name: true,
        iconUrl: true,
        groupId: true,
        group: { select: { name: true } },
        _count: { select: { competitors: true } },
        snapshots: {
          ...LATEST_HOME_LISTING,
          select: { capturedAt: true },
        },
        appSetup: true,
      },
    });

    const homeKeywords = this.activeHomeKeywords(apps);
    const [members, changes7d] = await Promise.all([
      Promise.all(apps.map((app) => this.portfolioMember(app, homeKeywords))),
      this.workspaceChanges(CHANGES_WINDOW_DAYS),
    ]);

    const portfolioApps = members.map((member) => member.app);
    portfolioApps.sort(
      (a, b) =>
        b.visibility.current - a.visibility.current ||
        (a.name ?? '').localeCompare(b.name ?? ''),
    );

    return {
      apps: portfolioApps,
      groups: groupAggregates(members).map((group): PortfolioGroup => ({
        id: group.id,
        name: group.name,
        memberAppIds: group.memberAppIds,
        visibility: groupVisibility(group.members),
        sparkline: groupVisibilityPoints(group.members),
      })),
      totals: {
        apps: portfolioApps.length,
        competitors: portfolioApps.reduce((sum, a) => sum + a.competitors, 0),
        trackedKeywords: portfolioApps.reduce(
          (sum, a) => sum + a.trackedKeywords,
          0,
        ),
        changes7d,
      },
    };
  }

  private async portfolioMember(
    app: {
      id: string;
      store: PortfolioApp['store'];
      storeAppId: string;
      country: string;
      name: string | null;
      iconUrl: string | null;
      groupId: string | null;
      group: { name: string } | null;
      _count: { competitors: number };
      snapshots: { capturedAt: Date }[];
      appSetup: AppSetup | null;
    },
    homeKeywords: Promise<Map<string, number>>,
  ): Promise<GroupMember & { app: PortfolioApp }> {
    const [{ rows, referenceDate: reference }, keywords] = await Promise.all([
      sparklineRows(this.prisma, app.id),
      homeKeywords,
    ]);

    return {
      appId: app.id,
      group:
        app.groupId && app.group
          ? { id: app.groupId, name: app.group.name }
          : null,
      rows,
      referenceDate: reference,
      app: {
        id: app.id,
        store: app.store,
        storeAppId: app.storeAppId,
        country: app.country,
        name: app.name,
        iconUrl: app.iconUrl,
        groupId: app.groupId,
        groupName: app.group?.name ?? null,
        visibility: windowVisibility(rows, reference),
        sparkline: visibilityPoints(rows),
        trackedKeywords: rows.length,
        competitors: app._count.competitors,
        lastCapturedAt: app.snapshots[0]?.capturedAt.toISOString() ?? null,
        setup: setupSummary(setupStateOf(app), {
          competitors: app._count.competitors,
          keywords: keywords.get(app.id) ?? 0,
        }),
      },
    };
  }

  private async activeHomeKeywords(
    apps: { id: string; country: string }[],
  ): Promise<Map<string, number>> {
    if (apps.length === 0) return new Map();
    const counts = await this.prisma.trackedKeyword.groupBy({
      by: ['appId'],
      where: {
        active: true,
        OR: apps.map((app) => ({
          appId: app.id,
          keyword: { country: app.country },
        })),
      },
      _count: { _all: true },
    });
    return new Map(counts.map((row) => [row.appId, row._count._all]));
  }

  private async workspaceChanges(days: number): Promise<number> {
    const apps = await this.prisma.app.findMany({
      select: { id: true },
    });
    const events = await this.prisma.changeEvent.findMany({
      where: {
        appId: { in: apps.map((app) => app.id) },
        ...HOME_EVENTS,
        capturedAt: { gte: new Date(Date.now() - days * DAY_MS) },
      },
      select: { appId: true, capturedAt: true },
    });
    return [...countChangeDays(events).values()].reduce(
      (total, count) => total + count,
      0,
    );
  }
}
