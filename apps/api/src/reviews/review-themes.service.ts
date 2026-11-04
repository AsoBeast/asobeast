import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import {
  addUtcDays,
  REVIEW_THEMES_BASELINE,
  ReviewReplyState,
  ReviewSort,
  ReviewSpikeTheme,
  ReviewThemes,
  type Store,
} from '@asobeast/shared';
import { Env } from '../config/env';
import { listingLanguages } from '../keywords/listing-languages';
import { PrismaService } from '../prisma/prisma.service';
import { reviewOrder, ReviewScope, reviewsWhere } from './review-list-query';
import {
  REVIEW_THEMES_CAP,
  reviewThemes,
  themeIgnoredWords,
  type ThemeOptions,
} from './review-themes';

interface ThemedApp {
  store: Store;
  country: string;
  name: string | null;
}

const THEMED_REVIEW = {
  id: true,
  title: true,
  text: true,
  score: true,
} as const;

@Injectable()
export class ReviewThemesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async themes(
    appId: string,
    scope: ReviewScope & { replyState?: ReviewReplyState; sort?: ReviewSort },
  ): Promise<ReviewThemes> {
    const app = await this.prisma.app.findFirst({
      where: { id: appId },
      select: { store: true, country: true, name: true },
    });
    if (!app) {
      throw new NotFoundException(`App ${appId} not found`);
    }
    const { repliedAt } = this.prisma.review.fields;
    const read = (
      where: Prisma.ReviewWhereInput,
      sort: ReviewSort,
      take: number,
    ) =>
      this.prisma.review.findMany({
        where,
        orderBy: reviewOrder(sort),
        take,
        select: THEMED_REVIEW,
      });
    const [baseline, shown] = await Promise.all([
      read(
        reviewsWhere(
          appId,
          { version: scope.version, from: scope.from },
          undefined,
          repliedAt,
        ),
        'newest',
        REVIEW_THEMES_BASELINE,
      ),
      read(
        reviewsWhere(appId, scope, scope.replyState, repliedAt),
        scope.sort ?? 'newest',
        REVIEW_THEMES_CAP,
      ),
    ]);
    const options = this.optionsFor(app);
    return {
      themes: reviewThemes(baseline, shown, options),
      reviews: shown.length,
      negativeScoreMax: options.negativeScoreMax,
    };
  }

  async dayTheme(
    app: ThemedApp & { id: string },
    day: string,
  ): Promise<ReviewSpikeTheme | null> {
    const [baseline, shown] = await Promise.all([
      this.prisma.review.findMany({
        where: { appId: app.id },
        orderBy: reviewOrder('newest'),
        take: REVIEW_THEMES_BASELINE,
        select: THEMED_REVIEW,
      }),
      this.prisma.review.findMany({
        where: {
          appId: app.id,
          reviewedAt: {
            gte: new Date(`${day}T00:00:00.000Z`),
            lt: new Date(`${addUtcDays(day, 1)}T00:00:00.000Z`),
          },
        },
        orderBy: reviewOrder('newest'),
        take: REVIEW_THEMES_CAP,
        select: THEMED_REVIEW,
      }),
    ]);
    const [top] = reviewThemes(baseline, shown, this.optionsFor(app));
    return top
      ? { phrase: top.phrase, kind: top.kind, mentions: top.mentions }
      : null;
  }

  private optionsFor(app: ThemedApp): ThemeOptions {
    return {
      languages: listingLanguages(app.store, app.country),
      negativeScoreMax: this.config.get('ALERT_REVIEW_SCORE_MAX', {
        infer: true,
      }),
      ignored: themeIgnoredWords(app.name),
    };
  }
}
