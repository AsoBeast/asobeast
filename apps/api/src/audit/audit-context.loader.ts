import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Store } from '@prisma/client';
import { tokenize, TrackedKeywordItem } from '@asobeast/shared';
import { AnalyticsService } from '../analytics/analytics.service';
import { Env } from '../config/env';
import { KeywordsService } from '../keywords/keywords.service';
import { PrismaService } from '../prisma/prisma.service';
import { extractRawFacts } from '../store-providers/raw-facts';
import { effectiveRun } from './audit-run-state';
import { AuditAiService } from './audit-ai.service';
import {
  AuditCompetitor,
  AuditContext,
  AuditCreativeState,
  AuditKeyword,
  AuditVisibility,
  DAY_MS,
} from './audit-scoring';
import {
  CreativeInputs,
  creativeFingerprint,
  MAX_COMPETITOR_ICONS,
  readStoredObservations,
} from './creative/creative-observations';

export interface AuditApp {
  id: string;
  store: Store;
  country: string;
  name: string | null;
  isCompetitor: boolean;
}

export const REVIEW_WINDOW_DAYS = 90;
export const VISIBILITY_WINDOW_DAYS = 8;
export const VISIBILITY_TREND_DAYS = 7;

const iconCompetitors = (
  competitors: { id: string; iconUrl: string | null }[],
): { id: string; iconUrl: string }[] =>
  competitors
    .flatMap(({ id, iconUrl }) => (iconUrl === null ? [] : [{ id, iconUrl }]))
    .slice(0, MAX_COMPETITOR_ICONS);

@Injectable()
export class AuditContextLoader {
  constructor(
    private readonly prisma: PrismaService,
    private readonly keywords: KeywordsService,
    private readonly auditAi: AuditAiService,
    private readonly analytics: AnalyticsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async app(appId: string): Promise<AuditApp> {
    const app = await this.prisma.app.findFirst({
      where: { id: appId },
      select: {
        id: true,
        store: true,
        country: true,
        name: true,
        isCompetitor: true,
      },
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

  private async visibility(appId: string): Promise<AuditVisibility> {
    const from = new Date(Date.now() - VISIBILITY_WINDOW_DAYS * DAY_MS);
    const { points } = await this.analytics.history(appId, {
      from: from.toISOString().slice(0, 10),
    });
    const latest = points.at(-1) ?? null;
    if (latest === null) {
      return { latest: null, latestDate: null, weekAgo: null };
    }
    const cutoff = new Date(
      new Date(latest.date).getTime() - VISIBILITY_TREND_DAYS * DAY_MS,
    );
    const earlier = points.filter(
      (point) => new Date(point.date).getTime() <= cutoff.getTime(),
    );
    return {
      latest: latest.visibility,
      latestDate: latest.date,
      weekAgo: earlier.at(-1)?.visibility ?? null,
    };
  }

  async creativeInputs(appId: string): Promise<CreativeInputs> {
    const app = await this.app(appId);
    const [latest, competitors] = await Promise.all([
      this.prisma.appSnapshot.findFirst({
        where: { appId },
        orderBy: { capturedAt: 'desc' },
      }),
      this.prisma.app.findMany({
        where: { primaryAppId: appId },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          store: true,
          snapshots: {
            orderBy: { capturedAt: 'desc' },
            take: 1,
            select: { raw: true },
          },
        },
      }),
    ]);
    const facts = extractRawFacts(app.store, latest?.raw);
    return {
      store: app.store,
      country: app.country,
      title: latest?.title ?? '',
      iconUrl: facts.iconUrl,
      screenshotUrls: facts.screenshotUrls,
      competitorIconUrls: iconCompetitors(
        competitors.map((competitor) => ({
          id: competitor.id,
          iconUrl: extractRawFacts(
            competitor.store,
            competitor.snapshots[0]?.raw,
          ).iconUrl,
        })),
      ).map((competitor) => competitor.iconUrl),
    };
  }

  private creativeState(
    inputs: CreativeInputs,
    iconCompetitorIds: string[],
    insight: {
      observations: unknown;
      inputHash: string | null;
      generatedAt: Date | null;
      model: string;
    } | null,
  ): AuditCreativeState {
    const observations = readStoredObservations(insight?.observations ?? null);
    const model = this.auditAi.model;
    return {
      observations,
      inputs,
      iconCompetitorIds,
      analyzedAt: insight?.generatedAt ?? null,
      model: insight?.model ?? null,
      stale:
        observations !== null &&
        model !== null &&
        insight?.inputHash !== creativeFingerprint(inputs, model),
    };
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
      visibility,
    ] = await Promise.all([
      this.prisma.appSnapshot.findFirst({
        where: { appId },
        orderBy: { capturedAt: 'desc' },
      }),
      this.keywords.listTracked(appId),
      this.keywords.compare(appId, false),
      this.prisma.app.findMany({
        where: { primaryAppId: appId },
        orderBy: { createdAt: 'asc' },
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
        select: {
          score: true,
          title: true,
          text: true,
          reviewedAt: true,
          repliedAt: true,
          replyCheckedAt: true,
        },
      }),
      this.prisma.auditInsight.findUnique({ where: { appId } }),
      this.keywordField(app),
      this.visibility(appId),
    ]);

    const active = tracked.filter(
      (item) => item.active && item.country === app.country,
    );
    const facts = extractRawFacts(app.store, latest?.raw);
    const mapped = competitors.map(toAuditCompetitor);
    const sent = iconCompetitors(mapped);
    const creative = this.creativeState(
      {
        store: app.store,
        country: app.country,
        title: latest?.title ?? '',
        iconUrl: facts.iconUrl,
        screenshotUrls: facts.screenshotUrls,
        competitorIconUrls: sent.map((competitor) => competitor.iconUrl),
      },
      sent.map((competitor) => competitor.id),
      insight,
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
      rawFacts: facts,
      keywords: active.map(toAuditKeyword),
      visibility,
      comparison,
      competitors: mapped,
      reviews: reviews.map((review) => ({
        score: review.score,
        title: review.title,
        text: review.text,
        reviewedAt: review.reviewedAt,
        repliedAt: review.repliedAt,
        replyCheckedAt: review.replyCheckedAt,
      })),
      reviewScoreMax: this.config.get('ALERT_REVIEW_SCORE_MAX', {
        infer: true,
      }),
      brandTokens: tokenize(app.name ?? ''),
      creative,
      run: effectiveRun(insight, new Date()),
      aiStatus: {
        configured: this.auditAi.configured,
        model: insight?.model ?? this.auditAi.model,
        generatedAt: insight?.generatedAt?.toISOString() ?? null,
        stale: creative.stale,
      },
    };
  }
}

const toAuditKeyword = (item: TrackedKeywordItem): AuditKeyword => ({
  id: item.keywordId,
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
