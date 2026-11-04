import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Store } from '@prisma/client';
import { addUtcDays, utcDayOf } from '@asobeast/shared';
import { AlertsDispatcher } from '../alerts/alerts.dispatcher';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import type { ReviewResult } from '../store-providers/types';
import { reviewSpikePayload } from './review-alert-payloads';
import {
  judgedDays,
  judgeSpike,
  REVIEW_SPIKE_BASELINE_DAYS,
  type DayCount,
} from './review-spike';
import { ReviewThemesService } from './review-themes.service';

export interface ReviewSpikeApp {
  id: string;
  name: string | null;
  store: Store;
  country: string;
}

interface DayRow {
  day: Date;
  count: number;
  low: number;
}

const startOf = (day: string): Date => new Date(`${day}T00:00:00.000Z`);

@Injectable()
export class ReviewSpikeAlerts {
  private readonly logger = new Logger(ReviewSpikeAlerts.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly themes: ReviewThemesService,
    private readonly config: ConfigService<Env, true>,
    private readonly alerts: AlertsDispatcher,
  ) {}

  async raise(
    app: ReviewSpikeApp,
    inserted: readonly ReviewResult[],
    now = new Date(),
  ): Promise<void> {
    try {
      await this.judge(app, inserted, now);
    } catch (error: unknown) {
      this.logger.warn(
        `review spike alert for app ${app.id} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async judge(
    app: ReviewSpikeApp,
    inserted: readonly ReviewResult[],
    now: Date,
  ): Promise<void> {
    const days = judgedDays(
      inserted.map((review) => review.updatedAt),
      now,
    );
    if (days.length === 0) return;
    const lowScoreMax = this.config.get('ALERT_REVIEW_SCORE_MAX', {
      infer: true,
    });
    const [oldest, counts] = await Promise.all([
      this.prisma.review.aggregate({
        where: { appId: app.id },
        _min: { reviewedAt: true },
      }),
      this.dayCounts(app.id, days[0], utcDayOf(now), lowScoreMax),
    ]);
    const oldestAt = oldest._min.reviewedAt;
    for (const day of days) {
      const spike = judgeSpike({
        day,
        counts,
        insertedOnDay: inserted.filter(
          (review) => review.updatedAt && utcDayOf(review.updatedAt) === day,
        ).length,
        oldestDay: oldestAt ? utcDayOf(oldestAt) : null,
      });
      if (!spike) continue;
      const topTheme = await this.themes.dayTheme(app, day);
      await this.alerts.dispatch(
        reviewSpikePayload(
          { id: app.id, name: app.name },
          spike,
          { lowScoreMax, topTheme },
          now,
        ),
      );
    }
  }

  private async dayCounts(
    appId: string,
    firstDay: string,
    today: string,
    lowScoreMax: number,
  ): Promise<Map<string, DayCount>> {
    const from = startOf(addUtcDays(firstDay, -REVIEW_SPIKE_BASELINE_DAYS));
    const to = startOf(addUtcDays(today, 1));
    const rows = await this.prisma.$queryRaw<DayRow[]>`
      SELECT "reviewedAt"::date AS day,
             COUNT(*)::int AS count,
             COUNT(*) FILTER (WHERE "score" <= ${lowScoreMax})::int AS low
      FROM "Review"
      WHERE "appId" = ${appId} AND "reviewedAt" >= ${from} AND "reviewedAt" < ${to}
      GROUP BY 1
    `;
    return new Map(
      rows.map((row) => [
        utcDayOf(row.day),
        { count: row.count, low: row.low },
      ]),
    );
  }
}
