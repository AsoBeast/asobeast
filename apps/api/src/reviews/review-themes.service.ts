import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { ReviewReplyState, ReviewThemes } from '@asobeast/shared';
import { Env } from '../config/env';
import { listingLanguages } from '../keywords/listing-languages';
import { PrismaService } from '../prisma/prisma.service';
import { reviewOrder, ReviewScope, reviewsWhere } from './review-list-query';
import {
  REVIEW_THEMES_BASELINE,
  REVIEW_THEMES_CAP,
  reviewThemes,
  themeIgnoredWords,
} from './review-themes';

@Injectable()
export class ReviewThemesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async themes(
    appId: string,
    scope: ReviewScope & { replyState?: ReviewReplyState },
  ): Promise<ReviewThemes> {
    const app = await this.prisma.app.findFirst({
      where: { id: appId },
      select: { store: true, country: true, name: true },
    });
    if (!app) {
      throw new NotFoundException(`App ${appId} not found`);
    }
    const { repliedAt } = this.prisma.review.fields;
    const newest = (where: Prisma.ReviewWhereInput, take: number) =>
      this.prisma.review.findMany({
        where,
        orderBy: reviewOrder('newest'),
        take,
        select: { id: true, title: true, text: true, score: true },
      });
    const [baseline, shown] = await Promise.all([
      newest(
        reviewsWhere(
          appId,
          { version: scope.version, from: scope.from },
          undefined,
          repliedAt,
        ),
        REVIEW_THEMES_BASELINE,
      ),
      newest(
        reviewsWhere(appId, scope, scope.replyState, repliedAt),
        REVIEW_THEMES_CAP,
      ),
    ]);
    const negativeScoreMax = this.config.get('ALERT_REVIEW_SCORE_MAX', {
      infer: true,
    });
    return {
      themes: reviewThemes(baseline, shown, {
        languages: listingLanguages(app.store, app.country),
        negativeScoreMax,
        ignored: themeIgnoredWords(app.name),
      }),
      reviews: shown.length,
      negativeScoreMax,
    };
  }
}
