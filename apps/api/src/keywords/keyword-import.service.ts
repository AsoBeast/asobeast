import { Injectable } from '@nestjs/common';
import {
  assertStorefront,
  KeywordImportQuota,
  KeywordImportRequest,
  KeywordImportResult,
} from '@asobeast/shared';
import { QuotaService } from '../auth/quota.service';
import { PrismaService } from '../prisma/prisma.service';
import { FirstPositionChecks } from './first-position-checks';
import {
  ClassifiedRow,
  classifyImportRows,
  ImportCandidate,
  pairKey,
} from './keyword-import';
import {
  Addition,
  costOf,
  ImportPlan,
  planImport,
  summarize,
} from './keyword-import-plan';
import { keywordQuotaOf } from './keyword-quota';
import { loadTrackingStates } from './keyword-tracking-state';
import { KeywordTracker } from './keyword-tracker';
import { ensureApp, KeywordApp } from './keywords.support';
import { MarketListingRequests } from './market-listing.requests';

const candidatesOf = (
  classified: readonly ClassifiedRow[],
): ImportCandidate[] =>
  classified.flatMap((row) =>
    row.kind === 'candidate' ? [row.candidate] : [],
  );

interface PlannedImport {
  app: KeywordApp;
  plan: ImportPlan;
  quota: KeywordImportQuota | null;
  marketListings: number;
}

@Injectable()
export class KeywordImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tracker: KeywordTracker,
    private readonly quota: QuotaService,
    private readonly listings: MarketListingRequests,
    private readonly checks: FirstPositionChecks,
  ) {}

  async preview(
    appId: string,
    request: KeywordImportRequest,
  ): Promise<KeywordImportResult> {
    return this.result(await this.planned(appId, request), 0, true);
  }

  async import(
    appId: string,
    request: KeywordImportRequest,
  ): Promise<KeywordImportResult> {
    const planned = await this.planned(appId, request);
    const imported = await this.write(planned.app, planned.plan.additions);
    if (!planned.quota || imported === 0) {
      return this.result(planned, imported, false);
    }
    const usage = await this.quota.usage();
    const quota = keywordQuotaOf(usage, this.quota.upgradeFrom(usage.plan));
    return this.result({ ...planned, quota }, imported, false);
  }

  private async planned(
    appId: string,
    request: KeywordImportRequest,
  ): Promise<PlannedImport> {
    const app = await ensureApp(this.prisma, appId);
    const context = {
      store: app.store,
      country: request.country ?? app.country,
    };
    assertStorefront(context.store, context.country);
    const classified = classifyImportRows(request.rows, context);
    const [tracking, usage] = await Promise.all([
      loadTrackingStates(this.prisma, app, candidatesOf(classified)),
      this.quota.usage(),
    ]);
    const limit = usage.limits.keywordMarkets;
    const room =
      limit === null ? null : Math.max(0, limit - usage.keywordMarkets);
    const plan = planImport(classified, tracking, room);
    return {
      app,
      plan,
      quota: keywordQuotaOf(usage, this.quota.upgradeFrom(usage.plan)),
      marketListings: await this.listingsOpened(app, plan.additions),
    };
  }

  private async listingsOpened(
    app: KeywordApp,
    additions: readonly Addition[],
  ): Promise<number> {
    const markets = [
      ...new Set(additions.map(({ candidate }) => candidate.country)),
    ].filter((country) => country !== app.country);
    if (markets.length === 0) {
      return 0;
    }
    const [tracked, family] = await Promise.all([
      this.prisma.keyword.findMany({
        where: {
          store: app.store,
          country: { in: markets },
          tracked: { some: { appId: app.id, active: true } },
        },
        select: { country: true },
        distinct: ['country'],
      }),
      this.prisma.app.count({
        where: { OR: [{ id: app.id }, { primaryAppId: app.id }] },
      }),
    ]);
    return (markets.length - tracked.length) * family;
  }

  private async write(
    app: KeywordApp,
    additions: readonly Addition[],
  ): Promise<number> {
    if (additions.length === 0) {
      return 0;
    }
    const ids = await this.tracker.keywordIdsAcrossMarkets(
      additions.map(({ candidate }) => ({
        text: candidate.text,
        country: candidate.country,
      })),
      app.store,
    );
    const located = additions.flatMap((addition) => {
      const keywordId = ids.get(
        pairKey(addition.candidate.country, addition.candidate.text),
      );
      return keywordId ? [{ addition, keywordId }] : [];
    });
    const keywordIds = located.map(({ keywordId }) => keywordId);
    const created = located.filter(({ addition }) => addition.status === 'new');
    const resumed = located.filter(
      ({ addition }) => addition.status === 'resume',
    );
    let imported = 0;
    await this.quota.admitKeywordMarkets(async (tx) => {
      const added = await tx.trackedKeyword.createMany({
        data: created.map(({ addition, keywordId }) => ({
          appId: app.id,
          keywordId,
          source: 'MANUAL' as const,
          active: true,
          tags: addition.candidate.tags,
          note: addition.candidate.note,
        })),
        skipDuplicates: true,
      });
      const reactivated = await tx.trackedKeyword.updateMany({
        where: {
          appId: app.id,
          active: false,
          keywordId: { in: resumed.map(({ keywordId }) => keywordId) },
        },
        data: { active: true },
      });
      await this.tracker.claimForManual(tx, app.id, keywordIds);
      imported = added.count + reactivated.count;
    });
    await this.tracker.enqueueFirstScores(keywordIds, app);
    await this.checks.schedule(app.id, keywordIds);
    const markets = new Set(
      located.map(({ addition }) => addition.candidate.country),
    );
    for (const market of markets) {
      await this.listings.request(app, market);
    }
    return imported;
  }

  private result(
    { app, plan, quota, marketListings }: PlannedImport,
    imported: number,
    dryRun: boolean,
  ): KeywordImportResult {
    return {
      dryRun,
      imported,
      summary: summarize(plan.results),
      cost: costOf(plan.additions, app.store, marketListings),
      quota,
      results: plan.results,
    };
  }
}
