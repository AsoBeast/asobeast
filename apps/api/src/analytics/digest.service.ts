import { Injectable, Logger } from '@nestjs/common';
import {
  DigestAppSummary,
  DigestGroupSummary,
  DigestWeeklyPayload,
} from '@asobeast/shared';
import { PrismaService } from '../prisma/prisma.service';
import {
  addDays,
  GroupMember,
  groupAggregates,
  groupVisibility,
  sparklineRows,
  startOfUtcDay,
  toDateKey,
  windowVisibility,
} from './analytics.support';
import { movers } from './movers';

const DIGEST_WINDOW_DAYS = 7;
const DIGEST_MOVER_LIMIT = 3;

type DigestActionCounts = NonNullable<DigestAppSummary['actions']>;

const EMPTY_ACTION_COUNTS: DigestActionCounts = {
  open: 0,
  critical: 0,
  high: 0,
};

@Injectable()
export class DigestService {
  private readonly logger = new Logger(DigestService.name);

  constructor(private readonly prisma: PrismaService) {}

  async buildDigest(reviewScoreMax: number): Promise<DigestWeeklyPayload> {
    const now = new Date();
    const to = startOfUtcDay(now);
    const from = addDays(to, -DIGEST_WINDOW_DAYS);

    const apps = await this.prisma.app.findMany({
      where: { isCompetitor: false },
      select: {
        id: true,
        name: true,
        groupId: true,
        group: { select: { name: true } },
        competitors: { select: { id: true } },
      },
    });

    const [members, actions] = await Promise.all([
      Promise.all(
        apps.map((app) => this.digestApp(app, from, to, reviewScoreMax)),
      ),
      this.actionCounts(apps.map((app) => app.id)),
    ]);

    return {
      event: 'digest.weekly',
      occurredAt: now.toISOString(),
      window: { from: toDateKey(from), to: toDateKey(to) },
      apps: members.map((member) => ({
        ...member.summary,
        actions:
          actions === null
            ? null
            : (actions.get(member.appId) ?? EMPTY_ACTION_COUNTS),
      })),
      groups: groupAggregates(members).map((group): DigestGroupSummary => ({
        id: group.id,
        name: group.name,
        visibility: groupVisibility(group.members),
      })),
    };
  }

  private async digestApp(
    app: {
      id: string;
      name: string | null;
      groupId: string | null;
      group: { name: string } | null;
      competitors: { id: string }[];
    },
    from: Date,
    to: Date,
    reviewScoreMax: number,
  ): Promise<GroupMember & { summary: DigestAppSummary }> {
    const { rows, referenceDate: reference } = await sparklineRows(
      this.prisma,
      app.id,
    );
    const moved = reference ? movers(rows, reference) : { up: [], down: [] };

    const appIds = [app.id, ...app.competitors.map((c) => c.id)];
    const rangeEnd = addDays(to, 1);
    const [changes, negativeReviews, audit] = await Promise.all([
      this.prisma.changeEvent.count({
        where: {
          appId: { in: appIds },
          capturedAt: { gte: from, lt: rangeEnd },
        },
      }),
      this.prisma.review.count({
        where: {
          appId: app.id,
          score: { lte: reviewScoreMax },
          createdAt: { gte: from, lt: rangeEnd },
        },
      }),
      this.auditDelta(app.id, to),
    ]);

    return {
      appId: app.id,
      group:
        app.groupId && app.group
          ? { id: app.groupId, name: app.group.name }
          : null,
      rows,
      referenceDate: reference,
      summary: {
        id: app.id,
        name: app.name,
        visibility: windowVisibility(rows, reference),
        moversUp: moved.up.slice(0, DIGEST_MOVER_LIMIT),
        moversDown: moved.down.slice(0, DIGEST_MOVER_LIMIT),
        changes,
        negativeReviews,
        audit,
        actions: null,
      },
    };
  }

  private async actionCounts(
    appIds: string[],
  ): Promise<Map<string, DigestActionCounts> | null> {
    if (appIds.length === 0) return new Map();
    try {
      const rows = await this.prisma.actionItem.groupBy({
        by: ['appId', 'priority'],
        where: {
          appId: { in: appIds },
          status: 'OPEN',
        },
        _count: { _all: true },
      });

      const counts = new Map<string, DigestActionCounts>();
      for (const row of rows) {
        const current = counts.get(row.appId) ?? { ...EMPTY_ACTION_COUNTS };
        current.open += row._count._all;
        if (row.priority === 'critical') current.critical += row._count._all;
        if (row.priority === 'high') current.high += row._count._all;
        counts.set(row.appId, current);
      }
      return counts;
    } catch (error) {
      this.logger.error('action counts unavailable for this digest', error);
      return null;
    }
  }

  private async auditDelta(
    appId: string,
    to: Date,
  ): Promise<DigestAppSummary['audit']> {
    const [current, baseline] = await Promise.all([
      this.prisma.auditScore.findFirst({
        where: { appId, date: { lte: to } },
        orderBy: { date: 'desc' },
        select: { date: true, overall: true },
      }),
      this.prisma.auditScore.findFirst({
        where: { appId, date: { lte: addDays(to, -DIGEST_WINDOW_DAYS) } },
        orderBy: { date: 'desc' },
        select: { date: true, overall: true },
      }),
    ]);

    if (!current) {
      return null;
    }

    const hasBaseline =
      baseline !== null && baseline.date.getTime() < current.date.getTime();
    const delta7d =
      hasBaseline && current.overall !== null && baseline.overall !== null
        ? current.overall - baseline.overall
        : null;

    return { current: current.overall, delta7d };
  }
}
