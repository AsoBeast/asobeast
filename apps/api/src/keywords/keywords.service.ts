import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { KeywordSource, Prisma, Store } from '@prisma/client';
import {
  assertStorefront,
  KeywordComparison,
  KeywordCountrySummary,
  keywordFieldBytes,
  KeywordFieldResult,
  KeywordSort,
  KeywordUpdateRequest,
  KEYWORD_FIELD_BYTE_LIMIT,
  marketLanguages,
  parseKeywordField,
  TrackedKeywordItem,
} from '@asobeast/shared';
import { QuotaService } from '../auth/quota.service';
import { PrismaService } from '../prisma/prisma.service';
import { classifyBuckets } from './buckets';
import { inKeywordField } from './keyword-field-membership';
import { extractCandidates } from './extraction';
import { homeListingTexts } from './home-listings';
import { interleaveDistinct } from './interleave';
import { KeywordTracker, keywordRows } from './keyword-tracker';
import {
  isGap,
  latestPositions,
  positionKey,
  sortComparison,
} from './keyword-gaps';
import { sortTracked } from './keyword-sort';
import { serpVolatilities } from './keyword-volatility';
import { toTrackedKeywordItem } from './keywords.mapper';
import { listingFacts } from './listing-facts';
import { MarketListingRequests } from './market-listing.requests';
import {
  ensureApp,
  KeywordApp,
  normalizeKeyword,
  trackedArgs,
  trackedOrder,
} from './keywords.support';

const AUTO_TRACK_LIMIT = 15;
const KEYWORD_FIELD_LOCK = 3_958_261;

@Injectable()
export class KeywordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tracker: KeywordTracker,
    private readonly quota: QuotaService,
    private readonly listings: MarketListingRequests,
  ) {}

  async listTracked(
    appId: string,
    sort?: KeywordSort,
    country?: string,
  ): Promise<TrackedKeywordItem[]> {
    const app = await ensureApp(this.prisma, appId);
    const rows = await this.prisma.trackedKeyword.findMany({
      where: { appId, ...(country ? { keyword: { is: { country } } } : {}) },
      ...trackedArgs(appId),
    });
    const [facts, volatility] = await Promise.all([
      listingFacts(this.prisma, app, [
        ...new Set(rows.map((row) => row.keyword.country)),
      ]),
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
            facts,
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
    assertStorefront(app.store, market);
    const texts = new Set(rawKeywords.map((raw) => normalizeKeyword(raw)));

    const keywordIds = await this.tracker.keywordIdsFor(
      [...texts],
      app.store,
      market,
    );

    await this.quota.admitKeywordMarkets(async (tx) => {
      for (const keywordId of keywordIds) {
        await this.tracker.track(
          tx,
          { appId, keywordId, source: 'MANUAL', active: true },
          { active: true },
        );
      }
      await this.tracker.claimForManual(tx, appId, keywordIds);
    });

    for (const keywordId of keywordIds) {
      await this.tracker.enqueueFirstScore(keywordId, app);
    }
    await this.listings.request(app, market);

    return this.listTracked(appId, undefined, market);
  }

  async updateKeyword(
    appId: string,
    keywordId: string,
    data: KeywordUpdateRequest,
  ): Promise<TrackedKeywordItem> {
    const app = await ensureApp(this.prisma, appId);
    const keyword = await this.ensureTracked(appId, keywordId);
    if (data.active === true) {
      assertStorefront(keyword.store, keyword.country);
    }
    const update = {
      ...(data.active === undefined ? {} : { active: data.active }),
      ...(data.relevance === undefined ? {} : { relevance: data.relevance }),
      ...(data.tags === undefined ? {} : { tags: data.tags }),
      ...(data.note === undefined ? {} : { note: data.note }),
    };
    if (data.active === true) {
      await this.quota.admitKeywordMarkets(async (tx) => {
        await tx.trackedKeyword.update({
          where: { appId_keywordId: { appId, keywordId } },
          data: update,
        });
        await this.tracker.claimForManual(tx, appId, [keywordId]);
      });
      await this.listings.request(app, keyword.country);
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

  private serializeKeywordField(
    tx: Prisma.TransactionClient,
    appId: string,
  ): Promise<number> {
    return tx.$executeRaw`SELECT pg_advisory_xact_lock(${KEYWORD_FIELD_LOCK}, hashtext(${appId}))`;
  }

  private async keywordFieldResult(
    app: KeywordApp,
    duplicatesRemoved: number,
  ): Promise<KeywordFieldResult> {
    const rows = await this.prisma.trackedKeyword.findMany({
      where: {
        appId: app.id,
        ...inKeywordField,
        active: true,
        keyword: { is: { country: app.country } },
      },
      ...trackedArgs(app.id),
      orderBy: [{ fieldOrder: 'asc' }, ...trackedOrder()],
    });
    const [facts, volatility] = await Promise.all([
      listingFacts(this.prisma, app),
      serpVolatilities(
        this.prisma,
        rows.map((row) => row.keywordId),
      ),
    ]);
    const tracked = rows.map((row) =>
      toTrackedKeywordItem(row, facts, volatility.get(row.keywordId) ?? null),
    );

    return {
      tracked,
      charactersUsed: keywordFieldBytes(tracked.map((item) => item.text)),
      charactersLimit: KEYWORD_FIELD_BYTE_LIMIT,
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

    const { phrases, duplicatesRemoved } = parseKeywordField(text);
    const unique = phrases.map(normalizeKeyword);
    if (keywordFieldBytes(unique) > KEYWORD_FIELD_BYTE_LIMIT) {
      throw new BadRequestException(
        `Keyword field exceeds ${KEYWORD_FIELD_BYTE_LIMIT} bytes`,
      );
    }

    const keywordIds = await this.tracker.keywordIdsFor(
      unique,
      app.store,
      app.country,
    );

    await this.quota.admitKeywordMarkets(async (tx) => {
      await this.serializeKeywordField(tx, appId);
      for (const [fieldOrder, keywordId] of keywordIds.entries()) {
        await this.tracker.track(
          tx,
          {
            appId,
            keywordId,
            source: 'KEYWORD_FIELD',
            active: true,
            fieldOrder,
          },
          { active: true, fieldOrder },
        );
      }
      const dropped = {
        appId,
        ...inKeywordField,
        keywordId: { notIn: keywordIds },
      };
      await tx.trackedKeyword.updateMany({
        where: { ...dropped, source: 'KEYWORD_FIELD' },
        data: { active: false, fieldOrder: null },
      });
      await tx.trackedKeyword.updateMany({
        where: dropped,
        data: { fieldOrder: null },
      });
    });

    for (const keywordId of keywordIds) {
      await this.tracker.enqueueFirstScore(keywordId, app);
    }

    return this.keywordFieldResult(app, duplicatesRemoved);
  }

  async syncFromSnapshot(appId: string): Promise<void> {
    const app = await this.prisma.app.findUnique({
      where: { id: appId },
      select: {
        id: true,
        workspaceId: true,
        store: true,
        country: true,
        isCompetitor: true,
      },
    });
    if (!app || app.isCompetitor) {
      return;
    }

    const listings = await homeListingTexts(this.prisma, app);
    if (listings.length === 0) {
      return;
    }

    const autoTrackSources: KeywordSource[] =
      app.store === Store.GOOGLE_PLAY
        ? ['TITLE', 'DESCRIPTION']
        : ['TITLE', 'SUBTITLE'];

    const languages = marketLanguages(app.country);
    const candidates = interleaveDistinct(
      listings.map((listing) =>
        extractCandidates(
          {
            title: listing.title,
            subtitle: listing.subtitle ?? undefined,
            summary: listing.summary ?? undefined,
          },
          languages,
        ).filter((candidate) => autoTrackSources.includes(candidate.source)),
      ),
      AUTO_TRACK_LIMIT,
      (candidate) => candidate.text,
    );

    await this.prisma.keyword.createMany({
      data: keywordRows(
        candidates.map((candidate) => candidate.text),
        app.store,
        app.country,
      ),
      skipDuplicates: true,
    });

    const keywords = await this.prisma.keyword.findMany({
      where: {
        store: app.store,
        country: app.country,
        text: { in: candidates.map((candidate) => candidate.text) },
      },
      select: { id: true, text: true },
    });
    const keywordIdByText = new Map(
      keywords.map((keyword) => [keyword.text, keyword.id]),
    );

    const tracked = candidates.flatMap((candidate) => {
      const keywordId = keywordIdByText.get(candidate.text);
      return keywordId
        ? [
            {
              appId: app.id,
              keywordId,
              source: candidate.source,
              active: true,
            },
          ]
        : [];
    });

    await this.prisma.trackedKeyword.createMany({
      data: tracked,
      skipDuplicates: true,
    });
    await this.claimForSnapshot(app.id, tracked);

    for (const row of tracked) {
      await this.tracker.enqueueFirstScore(row.keywordId, app);
    }
  }

  private async claimForSnapshot(
    appId: string,
    tracked: { keywordId: string; source: KeywordSource }[],
  ): Promise<void> {
    for (const source of new Set(tracked.map((row) => row.source))) {
      await this.prisma.trackedKeyword.updateMany({
        where: {
          appId,
          source: 'KEYWORD_FIELD',
          keywordId: {
            in: tracked
              .filter((row) => row.source === source)
              .map((row) => row.keywordId),
          },
        },
        data: { source },
      });
    }
  }

  private async ensureTracked(
    appId: string,
    keywordId: string,
  ): Promise<{ store: Store; country: string }> {
    const tracked = await this.prisma.trackedKeyword.findUnique({
      where: { appId_keywordId: { appId, keywordId } },
      select: { keyword: { select: { store: true, country: true } } },
    });
    if (!tracked) {
      throw new NotFoundException(`Keyword ${keywordId} is not tracked`);
    }
    return tracked.keyword;
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
