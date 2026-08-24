import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuditCheckStatus,
  ChangeField,
  CHANGE_FIELDS,
  DailyBudget,
  KeywordCoverageRow,
  MetadataFieldAudit,
  Store,
  TrackedKeywordItem,
} from '@asobeast/shared';
import { AUDIT_FACTOR_LABELS } from '../audit/rubric';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { KeywordsService } from '../keywords/keywords.service';
import { MetadataService } from '../metadata/metadata.service';
import { SerpSnapshotDay } from '../rankings/serp-movers';
import { serpVolatilities } from '../keywords/keyword-volatility';
import { visibility } from '../analytics/visibility';
import { WorkspaceContext } from '../common/tenancy/workspace-context';

export interface ActionAuditCheck {
  id: string;
  label: string;
  status: AuditCheckStatus;
  score: number | null;
}

export interface ActionAuditFactor {
  id: string;
  label: string;
  weight: number;
  score: number | null;
  checks: ActionAuditCheck[];
}

export interface ActionAuditSnapshot {
  date: string;
  overall: number | null;
  coveredWeight: number;
  totalWeight: number;
  factors: ActionAuditFactor[];
}

export interface ActionRankingDay {
  date: string;
  position: number | null;
}

export interface ActionVisibilityPoint {
  date: string;
  visibility: number;
}

export interface ActionChangeEvent {
  field: ChangeField;
  capturedAt: Date;
}

export interface ActionReview {
  id: string;
  score: number;
  title: string | null;
  text: string;
  version: string | null;
  reviewedAt: Date | null;
}

export interface ActionContextApp {
  id: string;
  name: string | null;
  store: Store;
  storeAppId: string;
  country: string;
  trackedKeywords: TrackedKeywordItem[];
  keywordsByCountry: Map<string, TrackedKeywordItem[]>;
  coverage: KeywordCoverageRow[];
  metadataFields: MetadataFieldAudit[];
  audit: ActionAuditSnapshot | null;
  changeEvents: ActionChangeEvent[];
  visibilityByCountry: Map<string, ActionVisibilityPoint[]>;
  rankingDaysByKeyword: Map<string, ActionRankingDay[]>;
  serpDaysByKeyword: Map<string, SerpSnapshotDay[]>;
  volatilityByKeyword: Map<string, number | null>;
  competitorAppIdsByStoreAppId: Map<string, string>;
  reviews: ActionReview[];
  latestVersion: string | null;
  previousVersion: string | null;
}

export interface ActionContext {
  workspaceId: string;
  apps: ActionContextApp[];
  budget: DailyBudget;
  reviewScoreMax: number;
  rankDropThreshold: number;
}

export const CONTEXT_WINDOW_DAYS = 35;
export const CONTEXT_SERP_WINDOW_DAYS = 8;

interface SlimFactor {
  id: string;
  score: number | null;
  weight: number;
}

interface RankingRow {
  appId: string;
  keywordId: string;
  date: Date;
  position: number | null;
}

const dateKey = (date: Date): string => date.toISOString().slice(0, 10);

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const daysAgo = (now: Date, days: number): Date =>
  new Date(now.getTime() - days * 86_400_000);

function isSlimFactor(value: unknown): value is SlimFactor {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === 'string' &&
    typeof row.weight === 'number' &&
    (row.score === null || typeof row.score === 'number')
  );
}

function toAuditSnapshot(
  row: {
    date: Date;
    overall: number | null;
    coveredWeight: number;
    totalWeight: number;
    factors: unknown;
  } | null,
): ActionAuditSnapshot | null {
  if (!row || !Array.isArray(row.factors)) return null;
  return {
    date: dateKey(row.date),
    overall: row.overall,
    coveredWeight: row.coveredWeight,
    totalWeight: row.totalWeight,
    factors: row.factors.filter(isSlimFactor).map((factor) => ({
      id: factor.id,
      label: AUDIT_FACTOR_LABELS[factor.id] ?? factor.id,
      weight: factor.weight,
      score: factor.score,
      checks: [],
    })),
  };
}

function isChangeField(value: string): value is ChangeField {
  return CHANGE_FIELDS.some((field) => field === value);
}

function groupBy<T, K>(rows: T[], key: (row: T) => K): Map<K, T[]> {
  const grouped = new Map<K, T[]>();
  for (const row of rows) {
    const bucket = grouped.get(key(row));
    if (bucket) {
      bucket.push(row);
    } else {
      grouped.set(key(row), [row]);
    }
  }
  return grouped;
}

function visibilitySeries(
  keywords: TrackedKeywordItem[],
  rankings: RankingRow[],
): ActionVisibilityPoint[] {
  const traffic = new Map(
    keywords.map((keyword) => [keyword.keywordId, keyword.traffic]),
  );
  const tracked = new Set(keywords.map((keyword) => keyword.keywordId));
  const byDate = groupBy(
    rankings.filter((row) => tracked.has(row.keywordId)),
    (row) => dateKey(row.date),
  );

  return [...byDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, rows]) => ({
      date,
      visibility: visibility(
        rows.map((row) => ({
          traffic: traffic.get(row.keywordId) ?? null,
          position: row.position,
        })),
      ),
    }));
}

@Injectable()
export class ActionContextLoader {
  private readonly logger = new Logger(ActionContextLoader.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    private readonly keywords: KeywordsService,
    private readonly metadata: MetadataService,
    private readonly workspace: WorkspaceContext,
  ) {}

  async load(budget: DailyBudget, now: Date): Promise<ActionContext> {
    const apps = await this.prisma.app.findMany({
      where: { isCompetitor: false },
      select: {
        id: true,
        name: true,
        store: true,
        storeAppId: true,
        country: true,
        competitors: { select: { id: true, storeAppId: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const base: ActionContext = {
      workspaceId: this.workspace.require('action generation'),
      apps: [],
      budget,
      reviewScoreMax: this.config.get('ALERT_REVIEW_SCORE_MAX', {
        infer: true,
      }),
      rankDropThreshold: this.config.get('ALERT_RANK_DROP_THRESHOLD', {
        infer: true,
      }),
    };
    if (apps.length === 0) return base;

    const appIds = apps.map((app) => app.id);
    const from = daysAgo(now, CONTEXT_WINDOW_DAYS);
    const serpFrom = daysAgo(now, CONTEXT_SERP_WINDOW_DAYS);

    const [rankings, changeEvents, reviews, auditScores, snapshots] =
      await Promise.all([
        this.prisma.keywordRanking.findMany({
          where: { appId: { in: appIds }, date: { gte: from } },
          select: {
            appId: true,
            keywordId: true,
            date: true,
            position: true,
          },
          orderBy: { date: 'asc' },
        }),
        this.prisma.changeEvent.findMany({
          where: { appId: { in: appIds }, capturedAt: { gte: from } },
          select: { appId: true, field: true, capturedAt: true },
          orderBy: { capturedAt: 'asc' },
        }),
        this.prisma.review.findMany({
          where: {
            appId: { in: appIds },
            OR: [
              { reviewedAt: { gte: from } },
              { reviewedAt: null, createdAt: { gte: from } },
            ],
          },
          select: {
            id: true,
            appId: true,
            score: true,
            title: true,
            text: true,
            version: true,
            reviewedAt: true,
          },
          orderBy: { reviewedAt: 'desc' },
        }),
        this.prisma.auditScore.findMany({
          where: { appId: { in: appIds } },
          orderBy: { date: 'desc' },
          distinct: ['appId'],
        }),
        this.prisma.appSnapshot.findMany({
          where: { appId: { in: appIds }, capturedAt: { gte: from } },
          select: { appId: true, version: true, capturedAt: true },
          orderBy: { capturedAt: 'desc' },
        }),
      ]);

    const rankingsByApp = groupBy(rankings, (row) => row.appId);
    const changesByApp = groupBy(changeEvents, (row) => row.appId);
    const reviewsByApp = groupBy(reviews, (row) => row.appId);
    const auditByApp = new Map(auditScores.map((row) => [row.appId, row]));
    const versionsByApp = groupBy(snapshots, (row) => row.appId);

    const derived = await Promise.all(apps.map((app) => this.derive(app.id)));
    const live = apps.flatMap((app, index) => {
      const rows = derived[index];
      return rows === null ? [] : [{ app, ...rows }];
    });
    if (live.length === 0) return base;

    const keywordIds = [
      ...new Set(
        live.flatMap((entry) => entry.tracked.map((item) => item.keywordId)),
      ),
    ];
    const [serpEntries, volatility] = await Promise.all([
      keywordIds.length === 0
        ? Promise.resolve([])
        : this.prisma.serpEntry.findMany({
            where: { keywordId: { in: keywordIds }, date: { gte: serpFrom } },
            select: {
              keywordId: true,
              date: true,
              position: true,
              storeAppId: true,
              title: true,
            },
            orderBy: [{ date: 'asc' }, { position: 'asc' }],
          }),
      serpVolatilities(this.prisma, keywordIds),
    ]);

    const serpByKeyword = groupBy(serpEntries, (row) => row.keywordId);

    return {
      ...base,
      apps: live.map(({ app, tracked, metadata }) =>
        this.buildApp(
          app,
          tracked,
          metadata,
          {
            rankings: rankingsByApp.get(app.id) ?? [],
            changes: changesByApp.get(app.id) ?? [],
            reviews: reviewsByApp.get(app.id) ?? [],
            audit: auditByApp.get(app.id) ?? null,
            versions: versionsByApp.get(app.id) ?? [],
          },
          serpByKeyword,
          volatility,
        ),
      ),
    };
  }

  private async derive(appId: string): Promise<{
    tracked: TrackedKeywordItem[];
    metadata: { coverage: KeywordCoverageRow[]; fields: MetadataFieldAudit[] };
  } | null> {
    try {
      const [tracked, metadata] = await Promise.all([
        this.keywords.listTracked(appId),
        this.metadata.audit(appId),
      ]);
      return { tracked, metadata };
    } catch (error) {
      this.logger.warn(
        `skipping app ${appId} in this action run: ${messageOf(error)}`,
      );
      return null;
    }
  }

  private buildApp(
    app: {
      id: string;
      name: string | null;
      store: Store;
      storeAppId: string;
      country: string;
      competitors: Array<{ id: string; storeAppId: string }>;
    },
    trackedKeywords: TrackedKeywordItem[],
    metadata: { coverage: KeywordCoverageRow[]; fields: MetadataFieldAudit[] },
    rows: {
      rankings: RankingRow[];
      changes: Array<{ field: string; capturedAt: Date }>;
      reviews: ActionReview[];
      audit: {
        date: Date;
        overall: number | null;
        coveredWeight: number;
        totalWeight: number;
        factors: unknown;
      } | null;
      versions: Array<{ version: string | null; capturedAt: Date }>;
    },
    serpByKeyword: Map<
      string,
      Array<{
        date: Date;
        position: number;
        storeAppId: string;
        title: string;
      }>
    >,
    volatility: Map<string, number | null>,
  ): ActionContextApp {
    const keywordsByCountry = groupBy(
      trackedKeywords,
      (keyword) => keyword.country,
    );
    const rankingsByKeyword = groupBy(rows.rankings, (row) => row.keywordId);
    const versions = rows.versions
      .map((row) => row.version)
      .filter((version): version is string => Boolean(version));
    const distinctVersions = [...new Set(versions)];

    const rankingDaysByKeyword = new Map<string, ActionRankingDay[]>();
    const serpDaysByKeyword = new Map<string, SerpSnapshotDay[]>();
    const volatilityByKeyword = new Map<string, number | null>();
    for (const keyword of trackedKeywords) {
      rankingDaysByKeyword.set(
        keyword.keywordId,
        (rankingsByKeyword.get(keyword.keywordId) ?? []).map((row) => ({
          date: dateKey(row.date),
          position: row.position,
        })),
      );
      const entries = groupBy(
        serpByKeyword.get(keyword.keywordId) ?? [],
        (row) => dateKey(row.date),
      );
      serpDaysByKeyword.set(
        keyword.keywordId,
        [...entries.entries()]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([date, dayEntries]) => ({
            date,
            entries: dayEntries.map((entry) => ({
              position: entry.position,
              storeAppId: entry.storeAppId,
              title: entry.title,
            })),
          })),
      );
      volatilityByKeyword.set(
        keyword.keywordId,
        volatility.get(keyword.keywordId) ?? null,
      );
    }

    const visibilityByCountry = new Map<string, ActionVisibilityPoint[]>();
    for (const [country, keywords] of keywordsByCountry) {
      visibilityByCountry.set(
        country,
        visibilitySeries(keywords, rows.rankings),
      );
    }

    return {
      id: app.id,
      name: app.name,
      store: app.store,
      storeAppId: app.storeAppId,
      country: app.country,
      trackedKeywords,
      keywordsByCountry,
      coverage: metadata.coverage,
      metadataFields: metadata.fields,
      audit: toAuditSnapshot(rows.audit),
      changeEvents: rows.changes
        .filter((row) => isChangeField(row.field))
        .map((row) => ({
          field: row.field as ChangeField,
          capturedAt: row.capturedAt,
        })),
      visibilityByCountry,
      rankingDaysByKeyword,
      serpDaysByKeyword,
      volatilityByKeyword,
      competitorAppIdsByStoreAppId: new Map(
        app.competitors.map((competitor) => [
          competitor.storeAppId,
          competitor.id,
        ]),
      ),
      reviews: rows.reviews,
      latestVersion: distinctVersions[0] ?? null,
      previousVersion: distinctVersions[1] ?? null,
    };
  }
}
