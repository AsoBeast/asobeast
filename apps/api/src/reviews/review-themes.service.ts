import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReviewReplyState, ReviewThemes } from '@asobeast/shared';
import { Env } from '../config/env';
import { listingLanguages } from '../keywords/listing-languages';
import { PrismaService } from '../prisma/prisma.service';
import { reviewOrder, ReviewScope, reviewsWhere } from './review-list-query';
import {
  REVIEW_THEMES_CAP,
  reviewThemes,
  themeExclusions,
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
    const reviews = await this.prisma.review.findMany({
      where: reviewsWhere(
        appId,
        scope,
        scope.replyState,
        this.prisma.review.fields.repliedAt,
      ),
      orderBy: reviewOrder('newest'),
      take: REVIEW_THEMES_CAP,
      select: { title: true, text: true, score: true },
    });
    const negativeScoreMax = this.config.get('ALERT_REVIEW_SCORE_MAX', {
      infer: true,
    });
    return {
      themes: reviewThemes(reviews, {
        languages: listingLanguages(app.store, app.country),
        negativeScoreMax,
        excluded: themeExclusions(app.name),
      }),
      reviews: reviews.length,
      negativeScoreMax,
    };
  }
}
