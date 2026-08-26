import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { KeywordSource, Store } from '@prisma/client';
import { Queue } from 'bullmq';
import {
  KeywordComparison,
  KeywordCountrySummary,
  KeywordFieldResult,
  KeywordSort,
  KEYWORD_FIELD_CHAR_LIMIT,
  normalizeText,
  TrackedKeywordItem,
} from '@asobeast/shared';
import { isoWeekKey, JOBS, QUEUES, scoreJobId } from '../jobs/jobs.types';
import { QuotaService } from '../auth/quota.service';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { PrismaService } from '../prisma/prisma.service';
import { classifyBuckets } from './buckets';
import { extractCandidates } from './extraction';
import {
  isGap,
  latestPositions,
  positionKey,
  sortComparison,
} from './keyword-gaps';
import { sortTracked } from './keyword-sort';
import { serpVolatilities } from './keyword-volatility';
import { toTrackedKeywordItem } from './keywords.mapper';
import {
  ensureApp,
  KeywordApp,
  normalizeKeyword,
  queueFor,
  trackedArgs,
} from './keywords.support';

const AUTO_TRACK_LIMIT = 15;

@Injectable()
export class KeywordsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUES.APP_STORE) private readonly appStoreQueue: Queue,
    @InjectQueue(QUEUES.GPLAY) private readonly gplayQueue: Queue,
    private readonly quota: QuotaService,
    private readonly workspace: WorkspaceContext,
  ) {}

  private async enqueueFirstScore(
    keywordId: string,
    app: Pick<KeywordApp, 'store' | 'workspaceId'>,
  ): Promise<void> {
    const existing = await this.prisma.keywordMetric.findFirst({
      where: { keywordId },
      select: { keywordId: true },
    });
    if (existing) {
      return;
    }
    await queueFor(app.store, this.appStoreQueue, this.gplayQueue).add(
      JOBS.SCORE_KEYWORD,
      {
        keywordId,
        workspaceId: app.workspaceId,
        correlationId: this.workspace.correlationId,
      },
      { jobId: scoreJobId(keywordId, isoWeekKey()) },
    );
  }

  async listTracked(
    appId: string,
    sort?: KeywordSort,
    country?: string,
  ): Promise<TrackedKeywordItem[]> {
    await ensureApp(this.prisma, appId);
    const rows = await this.prisma.trackedKeyword.findMany({
      where: { appId, ...(country ? { keyword: { is: { country } } } : {}) },
      ...trackedArgs(appId),
    });
    const [snapshotText, volatility] = await Promise.all([
      this.snapshotText(appId),
      serpVolatilities(
        this.prisma,
        rows.map((row) => row.keywordId),
      ),
    ]);
    return sortTracked(
      classifyBuckets(
        rows.map((row) =>
          toTrackedKeywordItem(
            row,
            snapshotText,
            volatility.get(row.keywordId) ?? null,
          ),
        ),
      ),
      sort,
    );
  }

  async keywordCountries(appId: string): Promise<KeywordCountrySummary[]> {
    const app = await ensureApp(this.prisma, appId);
    const rows = await this.prisma.trackedKeyword.findMany({
      where: { appId },
      select: { keyword: { select: { country: true } } },
    });

    const counts = new Map<string, number>([[app.country, 0]]);
    for (const row of rows) {
      const country = row.keyword.country;
      counts.set(country, (counts.get(country) ?? 0) + 1);
    }

    return [...counts.entries()]
      .map(([country, keywordCount]) => ({ country, keywordCount }))
      .sort((a, b) => {
        if (a.country === app.country) return -1;
        if (b.country === app.country) return 1;
        return b.keywordCount - a.keywordCount;
      });
  }

  private async snapshotText(appId: string): Promise<string> {
    const snapshot = await this.prisma.appSnapshot.findFirst({
      where: { appId },
      orderBy: { capturedAt: 'desc' },
      select: { title: true, subtitle: true, summary: true },
    });
    if (!snapshot) {
      return '';
    }
    return [snapshot.title, snapshot.subtitle, snapshot.summary]
      .filter((part): part is string => Boolean(part))
      .join(' ');
  }

  async compare(appId: string, onlyGaps: boolean): Promise<KeywordComparison> {
    await ensureApp(this.prisma, appId);

    const competitors = await this.prisma.app.findMany({
      where: { primaryAppId: appId },
      select: { id: true, name: true },
      orderBy: { createdAt: 'asc' },
    });

    const tracked = await this.prisma.trackedKeyword.findMany({
      where: { appId, active: true },
      orderBy: { createdAt: 'asc' },
      select: {
        keywordId: true,
        keyword: {
          select: {
            text: true,
            metrics: {
              orderBy: { date: 'desc' },
              take: 1,
              select: { traffic: true, difficulty: true },
            },
          },
        },
      },
    });

    const appIds = [appId, ...competitors.map((competitor) => competitor.id)];
    const latest = await latestPositions(
      this.prisma,
      appIds,
      tracked.map((row) => row.keywordId),
    );

    const rows = tracked.map((row) => {
      const you = latest.get(positionKey(appId, row.keywordId)) ?? null;
      const positions: Record<string, number | null> = {};
      for (const competitor of competitors) {
        positions[competitor.id] =
          latest.get(positionKey(competitor.id, row.keywordId)) ?? null;
      }
      const metric = row.keyword.metrics[0] ?? null;
      return {
        keywordId: row.keywordId,
        text: row.keyword.text,
        traffic: metric?.traffic ?? null,
        difficulty: metric?.difficulty ?? null,
        you,
        positions,
        gap: isGap(you, positions),
      };
    });

    const filtered = onlyGaps ? rows.filter((row) => row.gap) : rows;
    return { competitors, rows: sortComparison(filtered) };
  }

  async addManual(
    appId: string,
    rawKeywords: string[],
    country?: string,
  ): Promise<TrackedKeywordItem[]> {
    const app = await ensureApp(this.prisma, appId);
    const market = country ?? app.country;
    const texts = new Set(rawKeywords.map((raw) => normalizeKeyword(raw)));

    const keywordIds: string[] = [];
    for (const text of texts) {
      const keyword = await this.prisma.keyword.upsert({
        where: {
          text_store_country: { text, store: app.store, country: market },
        },
        create: { text, store: app.store, country: market },
        update: {},
        select: { id: true },
      });
      keywordIds.push(keyword.id);
    }

    await this.quota.admitKeywordMarkets(async (tx) => {
      for (const keywordId of keywordIds) {
        await tx.trackedKeyword.upsert({
          where: { appId_keywordId: { appId, keywordId } },
          create: { appId, keywordId, source: 'MANUAL', active: true },
          update: { active: true },
        });
      }
    });

    for (const keywordId of keywordIds) {
      await this.enqueueFirstScore(keywordId, app);
    }

    return this.listTracked(appId, undefined, market);
  }

  async updateKeyword(
    appId: string,
    keywordId: string,
    data: { active?: boolean; relevance?: number | null },
  ): Promise<TrackedKeywordItem> {
    await ensureApp(this.prisma, appId);
    await this.ensureTracked(appId, keywordId);
    const update = {
      ...(data.active === undefined ? {} : { active: data.active }),
      ...('relevance' in data ? { relevance: data.relevance } : {}),
    };
    if (data.active === true) {
      await this.quota.admitKeywordMarkets((tx) =>
        tx.trackedKeyword.update({
          where: { appId_keywordId: { appId, keywordId } },
          data: update,
        }),
      );
    } else {
      await this.prisma.trackedKeyword.update({
        where: { appId_keywordId: { appId, keywordId } },
        data: update,
      });
    }
    return this.getTrackedItem(appId, keywordId);
  }

  async remove(appId: string, keywordId: string): Promise<void> {
    await ensureApp(this.prisma, appId);
    await this.ensureTracked(appId, keywordId);
    await this.prisma.trackedKeyword.delete({
      where: { appId_keywordId: { appId, keywordId } },
    });
  }

  private ensureKeywordFieldStore(app: KeywordApp): void {
    if (app.store !== Store.APP_STORE) {
      throw new BadRequestException(
        'The keyword field is only available for App Store apps',
      );
    }
  }

  private async keywordFieldResult(
    app: KeywordApp,
    duplicatesRemoved: number,
  ): Promise<KeywordFieldResult> {
    const rows = await this.prisma.trackedKeyword.findMany({
      where: {
        appId: app.id,
        source: 'KEYWORD_FIELD',
        active: true,
        keyword: { is: { country: app.country } },
      },
      ...trackedArgs(app.id),
    });
    const [snapshotText, volatility] = await Promise.all([
      this.snapshotText(app.id),
      serpVolatilities(
        this.prisma,
        rows.map((row) => row.keywordId),
      ),
    ]);
    const tracked = rows.map((row) =>
      toTrackedKeywordItem(
        row,
        snapshotText,
        volatility.get(row.keywordId) ?? null,
      ),
    );

    return {
      tracked,
      charactersUsed: tracked.map((item) => item.text).join(',').length,
      charactersLimit: KEYWORD_FIELD_CHAR_LIMIT,
      duplicatesRemoved,
    };
  }

  async getKeywordField(appId: string): Promise<KeywordFieldResult> {
    const app = await ensureApp(this.prisma, appId);
    this.ensureKeywordFieldStore(app);
    return this.keywordFieldResult(app, 0);
  }

  async setKeywordField(
    appId: string,
    text: string,
  ): Promise<KeywordFieldResult> {
    const app = await ensureApp(this.prisma, appId);
    this.ensureKeywordFieldStore(app);

    const parsed = text
      .split(',')
      .map((part) => normalizeText(part))
      .filter((part) => part.length > 0);
    const unique = [...new Set(parsed)];
    const duplicatesRemoved = parsed.length - unique.length;

    const previous = await this.prisma.trackedKeyword.findMany({
      where: { appId, source: 'KEYWORD_FIELD' },
      select: { keywordId: true, keyword: { select: { text: true } } },
    });

    for (const value of unique) {
      const keyword = await this.prisma.keyword.upsert({
        where: {
          text_store_country: {
            text: value,
            store: app.store,
            country: app.country,
          },
        },
        create: { text: value, store: app.store, country: app.country },
        update: {},
        select: { id: true },
      });
      await this.prisma.trackedKeyword.upsert({
        where: { appId_keywordId: { appId, keywordId: keyword.id } },
        create: {
          appId,
          keywordId: keyword.id,
          source: 'KEYWORD_FIELD',
          active: true,
        },
        update: { source: 'KEYWORD_FIELD', active: true },
      });
      await this.enqueueFirstScore(keyword.id, app);
    }

    const uniqueSet = new Set(unique);
    const staleKeywordIds = previous
      .filter((row) => !uniqueSet.has(row.keyword.text))
      .map((row) => row.keywordId);
    if (staleKeywordIds.length > 0) {
      await this.prisma.trackedKeyword.updateMany({
        where: { appId, keywordId: { in: staleKeywordIds } },
        data: { active: false },
      });
    }

    return this.keywordFieldResult(app, duplicatesRemoved);
  }

  async syncFromSnapshot(appId: string): Promise<void> {
    const app = await this.prisma.app.findUnique({
      where: { id: appId },
      select: { id: true, workspaceId: true, store: true, country: true },
    });
    if (!app) {
      return;
    }

    const snapshot = await this.prisma.appSnapshot.findFirst({
      where: { appId },
      orderBy: { capturedAt: 'desc' },
      select: { title: true, subtitle: true, summary: true },
    });
    if (!snapshot) {
      return;
    }

    const autoTrackSources: KeywordSource[] =
      app.store === Store.GOOGLE_PLAY
        ? ['TITLE', 'DESCRIPTION']
        : ['TITLE', 'SUBTITLE'];

    const candidates = extractCandidates({
      title: snapshot.title,
      subtitle: snapshot.subtitle ?? undefined,
      summary: snapshot.summary ?? undefined,
    })
      .filter((candidate) => autoTrackSources.includes(candidate.source))
      .slice(0, AUTO_TRACK_LIMIT);

    for (const candidate of candidates) {
      const keyword = await this.prisma.keyword.upsert({
        where: {
          text_store_country: {
            text: candidate.text,
            store: app.store,
            country: app.country,
          },
        },
        create: {
          text: candidate.text,
          store: app.store,
          country: app.country,
        },
        update: {},
        select: { id: true },
      });

      await this.prisma.trackedKeyword.upsert({
        where: { appId_keywordId: { appId: app.id, keywordId: keyword.id } },
        create: {
          appId: app.id,
          keywordId: keyword.id,
          source: candidate.source,
          active: true,
        },
        update: {},
      });
      await this.enqueueFirstScore(keyword.id, app);
    }
  }

  private async ensureTracked(appId: string, keywordId: string): Promise<void> {
    const tracked = await this.prisma.trackedKeyword.findUnique({
      where: { appId_keywordId: { appId, keywordId } },
      select: { appId: true },
    });
    if (!tracked) {
      throw new NotFoundException(`Keyword ${keywordId} is not tracked`);
    }
  }

  private async getTrackedItem(
    appId: string,
    keywordId: string,
  ): Promise<TrackedKeywordItem> {
    const item = (await this.listTracked(appId)).find(
      (tracked) => tracked.keywordId === keywordId,
    );
    if (!item) {
      throw new NotFoundException(`Keyword ${keywordId} is not tracked`);
    }
    return item;
  }
}
