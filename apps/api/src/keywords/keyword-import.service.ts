import { Injectable } from '@nestjs/common';
import {
  assertStorefront,
  KeywordImportQuota,
  KeywordImportRequest,
  KeywordImportResult,
  nextPlan,
} from '@asobeast/shared';
import { QuotaService, WorkspaceUsage } from '../auth/quota.service';
import { PrismaService } from '../prisma/prisma.service';
import { ClassifiedRow, classifyImportRows, pairKey } from './keyword-import';
import {
  costOf,
  ImportPlan,
  planImport,
  summarize,
  TrackingLookup,
  TrackingState,
} from './keyword-import-plan';
import { ensureApp, KeywordApp } from './keywords.support';

interface PlannedImport {
  app: KeywordApp;
  plan: ImportPlan;
  quota: KeywordImportQuota | null;
}

@Injectable()
export class KeywordImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quota: QuotaService,
  ) {}

  async preview(
    appId: string,
    request: KeywordImportRequest,
  ): Promise<KeywordImportResult> {
    return this.result(await this.planned(appId, request), 0, true);
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
      this.trackingFor(app, classified),
      this.quota.usage(),
    ]);
    const limit = usage.limits.keywordMarkets;
    const room =
      limit === null ? null : Math.max(0, limit - usage.keywordMarkets);
    return {
      app,
      plan: planImport(classified, tracking, room),
      quota: this.quotaOf(usage),
    };
  }

  private result(
    { app, plan, quota }: PlannedImport,
    imported: number,
    dryRun: boolean,
  ): KeywordImportResult {
    return {
      dryRun,
      imported,
      summary: summarize(plan.results),
      cost: costOf(plan.additions, app.store),
      quota,
      results: plan.results,
    };
  }

  private quotaOf(usage: WorkspaceUsage): KeywordImportQuota | null {
    const limit = usage.limits.keywordMarkets;
    if (limit === null) {
      return null;
    }
    return {
      used: usage.keywordMarkets,
      limit,
      upgradeTo: this.quota.enforced ? nextPlan(usage.plan) : null,
    };
  }

  private async trackingFor(
    app: KeywordApp,
    classified: readonly ClassifiedRow[],
  ): Promise<TrackingLookup> {
    const candidates = classified.flatMap((row) =>
      row.kind === 'candidate' ? [row.candidate] : [],
    );
    if (candidates.length === 0) {
      return new Map();
    }
    const rows = await this.prisma.trackedKeyword.findMany({
      where: {
        keyword: {
          is: {
            store: app.store,
            text: { in: [...new Set(candidates.map(({ text }) => text))] },
            country: {
              in: [...new Set(candidates.map(({ country }) => country))],
            },
          },
        },
      },
      select: {
        appId: true,
        active: true,
        keyword: { select: { text: true, country: true } },
      },
    });
    const states = new Map<string, TrackingState>();
    for (const row of rows) {
      const key = pairKey(row.keyword.country, row.keyword.text);
      const state = states.get(key) ?? { own: null, elsewhere: false };
      if (row.appId === app.id) {
        state.own = row.active ? 'active' : 'paused';
      } else if (row.active) {
        state.elsewhere = true;
      }
      states.set(key, state);
    }
    return states;
  }
}
