import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Store } from '@prisma/client';
import { tokenize, TrackedKeywordItem } from '@asobeast/shared';
import { Env } from '../config/env';
import { KeywordsService } from '../keywords/keywords.service';
import { PrismaService } from '../prisma/prisma.service';
import { extractRawFacts } from '../store-providers/raw-facts';
import { AiAuditChecks, AuditAiService } from './audit-ai.service';
import {
  AuditCompetitor,
  AuditContext,
  AuditKeyword,
  DAY_MS,
} from './audit-scoring';

export interface AuditApp {
  id: string;
  store: Store;
  country: string;
  name: string | null;
}

export const REVIEW_WINDOW_DAYS = 90;

@Injectable()
export class AuditContextLoader {
  constructor(
    private readonly prisma: PrismaService,
    private readonly keywords: KeywordsService,
    private readonly auditAi: AuditAiService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async app(appId: string): Promise<AuditApp> {
    const app = await this.prisma.app.findFirst({
      where: { id: appId },
      select: { id: true, store: true, country: true, name: true },
    });
    if (!app) {
      throw new NotFoundException(`App ${appId} not found`);
    }
    return app;
  }

  private async keywordField(app: AuditApp): Promise<string | null> {
    if (app.store !== Store.APP_STORE) {
      return null;
    }
    const { tracked } = await this.keywords.getKeywordField(app.id);
    return tracked.map((item) => item.text).join(',') || null;
  }

  async load(appId: string): Promise<AuditContext> {
    const app = await this.app(appId);
    const reviewCutoff = new Date(Date.now() - REVIEW_WINDOW_DAYS * DAY_MS);

    const [
      latest,
      tracked,
      comparison,
      competitors,
      reviews,
      insight,
      keywordField,
    ] = await Promise.all([
      this.prisma.appSnapshot.findFirst({
        where: { appId },
        orderBy: { capturedAt: 'desc' },
      }),
      this.keywords.listTracked(appId),
      this.keywords.compare(appId, false),
      this.prisma.app.findMany({
        where: { primaryAppId: appId },
        select: {
          id: true,
          name: true,
          store: true,
          snapshots: {
            orderBy: { capturedAt: 'desc' },
            take: 1,
            select: {
              title: true,
              subtitle: true,
              ratingAvg: true,
              ratingCount: true,
              storeUpdatedAt: true,
              raw: true,
            },
          },
        },
      }),
      this.prisma.review.findMany({
        where: { appId, reviewedAt: { gte: reviewCutoff } },
        orderBy: { reviewedAt: 'desc' },
        select: { score: true, title: true, text: true, reviewedAt: true },
      }),
      this.prisma.auditInsight.findUnique({ where: { appId } }),
      this.keywordField(app),
    ]);

    const active = tracked.filter(
      (item) => item.active && item.country === app.country,
    );

    return {
      appId,
      store: app.store,
      country: app.country,
      title: latest?.title ?? '',
      subtitle: latest?.subtitle ?? null,
      summary: latest?.summary ?? null,
      description: latest?.description ?? '',
      keywordField,
      ratingAvg: latest?.ratingAvg ?? null,
      ratingCount: latest?.ratingCount ?? null,
      storeUpdatedAt: latest?.storeUpdatedAt ?? null,
      now: new Date(),
      rawFacts: extractRawFacts(app.store, latest?.raw),
      keywords: active.map(toAuditKeyword),
      rankings: rankingAggregates(active, comparison.rows),
      competitors: competitors.map(toAuditCompetitor),
      reviews: reviews.map((review) => ({
        score: review.score,
        title: review.title,
        text: review.text,
        reviewedAt: review.reviewedAt,
      })),
      reviewScoreMax: this.config.get('ALERT_REVIEW_SCORE_MAX', {
        infer: true,
      }),
      brandTokens: tokenize(app.name ?? ''),
      aiChecks: (insight?.checks as AiAuditChecks | undefined) ?? {},
      aiStatus: {
        configured: this.auditAi.configured,
        model: insight?.model ?? this.auditAi.model,
        generatedAt: insight?.generatedAt?.toISOString() ?? null,
      },
    };
  }
}

const rankingAggregates = (
  active: TrackedKeywordItem[],
  comparisonRows: { gap: boolean }[],
): AuditContext['rankings'] => {
  const total = active.length;
  const ranked = active.filter((item) => item.latestPosition !== null);
  const top10 = ranked.filter((item) => (item.latestPosition as number) <= 10);
  const deltas = active
    .map((item) => item.positionDelta7d)
    .filter((value): value is number => value !== null);
  return {
    top10Share: total === 0 ? 0 : top10.length / total,
    rankedShare: total === 0 ? 0 : ranked.length / total,
    avgDelta7d:
      deltas.length === 0
        ? null
        : deltas.reduce((sum, value) => sum + value, 0) / deltas.length,
    gapCount: comparisonRows.filter((row) => row.gap).length,
  };
};

const toAuditKeyword = (item: TrackedKeywordItem): AuditKeyword => ({
  text: item.text,
  source: item.source,
  bucket: item.bucket,
  relevance: item.relevance ?? 0,
  position: item.latestPosition,
  traffic: item.traffic,
  volume: item.volume,
  opportunity: item.opportunity,
});

const toAuditCompetitor = (row: {
  id: string;
  name: string | null;
  store: Store;
  snapshots: {
    title: string | null;
    subtitle: string | null;
    ratingAvg: number | null;
    ratingCount: number | null;
    storeUpdatedAt: Date | null;
    raw: unknown;
  }[];
}): AuditCompetitor => {
  const snapshot = row.snapshots[0];
  const facts = extractRawFacts(row.store, snapshot?.raw);
  return {
    id: row.id,
    name: row.name,
    title: snapshot?.title ?? null,
    subtitle: snapshot?.subtitle ?? null,
    ratingAvg: snapshot?.ratingAvg ?? null,
    ratingCount: snapshot?.ratingCount ?? null,
    screenshotCount: facts.screenshotCount,
    hasVideo: facts.videoUrl !== null,
    iconUrl: facts.iconUrl,
    storeUpdatedAt: snapshot?.storeUpdatedAt ?? null,
  };
};
