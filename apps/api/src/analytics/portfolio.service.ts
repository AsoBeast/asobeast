import { Injectable } from '@nestjs/common';
import {
  PortfolioApp,
  PortfolioGroup,
  PortfolioSummary,
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
          orderBy: { capturedAt: 'desc' },
          take: 1,
          select: { capturedAt: true },
        },
      },
    });

    const [members, changes7d] = await Promise.all([
      Promise.all(apps.map((app) => this.portfolioMember(app))),
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

  private async portfolioMember(app: {
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
  }): Promise<GroupMember & { app: PortfolioApp }> {
    const { rows, referenceDate: reference } = await sparklineRows(
      this.prisma,
      app.id,
    );

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
      },
    };
  }

  private async workspaceChanges(days: number): Promise<number> {
    const apps = await this.prisma.app.findMany({
      select: { id: true },
    });
    return this.prisma.changeEvent.count({
      where: {
        appId: { in: apps.map((app) => app.id) },
        capturedAt: { gte: new Date(Date.now() - days * DAY_MS) },
      },
    });
  }
}
