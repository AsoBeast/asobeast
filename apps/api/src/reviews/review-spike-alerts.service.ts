import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, Store } from '@prisma/client';
import type { AlertPayload, ReviewSpikeTheme } from '@asobeast/shared';
import { identityOf, withAppIdentity } from '../alerts/alert-app-identities';
import { AlertOutbox } from '../alerts/alert-outbox';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import type { ReviewResult } from '../store-providers/types';
import { reviewSpikePayload } from './review-alert-payloads';
import { readDayHistory } from './review-day-history';
import { judgedDays, judgeSpike, reviewsOn, withPending } from './review-spike';
import { ReviewThemesService } from './review-themes.service';

export interface ReviewSpikeApp {
  id: string;
  name: string | null;
  store: Store;
  country: string;
  iconUrl: string | null;
}

export type SpikeThemes = ReadonlyMap<string, ReviewSpikeTheme>;

export const NO_SPIKE_THEMES: SpikeThemes = new Map();

export interface SpikeSync {
  app: ReviewSpikeApp;
  inserted: readonly ReviewResult[];
  themes: SpikeThemes;
  now: Date;
}

interface JudgedDay {
  day: string;
  insertedOnDay: number;
  topTheme: ReviewSpikeTheme | null;
  now: Date;
}

const datesOf = (reviews: readonly ReviewResult[]) =>
  reviews.map((review) => review.updatedAt);

const reasonOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

@Injectable()
export class ReviewSpikeAlerts {
  private readonly logger = new Logger(ReviewSpikeAlerts.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly themes: ReviewThemesService,
    private readonly config: ConfigService<Env, true>,
    private readonly outbox: AlertOutbox,
  ) {}

  async themesFor(
    app: ReviewSpikeApp,
    pending: readonly ReviewResult[],
    now: Date,
  ): Promise<SpikeThemes> {
    const themes = new Map<string, ReviewSpikeTheme>();
    for (const day of judgedDays(datesOf(pending), now)) {
      const theme = await this.forecastTheme(app, day, pending).catch(
        (error: unknown) => {
          this.logger.warn(
            `review theme for app ${app.id} on ${day} failed: ${reasonOf(error)}`,
          );
          return null;
        },
      );
      if (theme) themes.set(day, theme);
    }
    return themes;
  }

  async record(tx: Prisma.TransactionClient, sync: SpikeSync): Promise<void> {
    for (const day of judgedDays(datesOf(sync.inserted), sync.now)) {
      await this.outbox.record(
        tx,
        `the review spike of app ${sync.app.id} on ${day}`,
        () =>
          this.spikeOn(tx, sync.app, {
            day,
            insertedOnDay: reviewsOn(sync.inserted, day).length,
            topTheme: sync.themes.get(day) ?? null,
            now: sync.now,
          }),
      );
    }
  }

  private async forecastTheme(
    app: ReviewSpikeApp,
    day: string,
    pending: readonly ReviewResult[],
  ): Promise<ReviewSpikeTheme | null> {
    const lowScoreMax = this.lowScoreMax();
    const stored = await this.prisma.withTransaction((tx) =>
      readDayHistory(tx, app.id, day, lowScoreMax),
    );
    const forecast = judgeSpike({
      day,
      insertedOnDay: reviewsOn(pending, day).length,
      ...withPending(stored, pending, lowScoreMax),
    });
    return forecast ? this.themes.dayTheme(app, day, pending) : null;
  }

  private async spikeOn(
    tx: Prisma.TransactionClient,
    app: ReviewSpikeApp,
    judged: JudgedDay,
  ): Promise<AlertPayload | null> {
    const lowScoreMax = this.lowScoreMax();
    const spike = judgeSpike({
      day: judged.day,
      insertedOnDay: judged.insertedOnDay,
      ...(await readDayHistory(tx, app.id, judged.day, lowScoreMax)),
    });
    if (!spike) return null;
    return withAppIdentity(
      reviewSpikePayload(
        { id: app.id, name: app.name },
        spike,
        { lowScoreMax, topTheme: judged.topTheme },
        judged.now,
      ),
      identityOf(app),
    );
  }

  private lowScoreMax(): number {
    return this.config.get('ALERT_REVIEW_SCORE_MAX', { infer: true });
  }
}
