import { Injectable } from '@nestjs/common';
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
import {
  EMPTY_ACTION_COUNTS,
  PortfolioSignals,
} from './portfolio-signals.service';
import { reviewsWrittenInWindow } from './review-window';
import { HOME_EVENTS } from '../apps/listing';

const DIGEST_WINDOW_DAYS = 7;
const DIGEST_MOVER_LIMIT = 3;

@Injectable()
export class DigestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly signals: PortfolioSignals,
  ) {}

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
      this.signals.actionCounts(apps.map((app) => app.id)),
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
          ...HOME_EVENTS,
          capturedAt: { gte: from, lt: rangeEnd },
        },
      }),
      this.prisma.review.count({
        where: {
          appId: app.id,
          score: { lte: reviewScoreMax },
          ...reviewsWrittenInWindow(from, rangeEnd),
        },
      }),
      this.signals.auditTrend(app.id, to),
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
}
