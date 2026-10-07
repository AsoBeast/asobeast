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
  Addition,
  costOf,
  ImportPlan,
  planImport,
  summarize,
  TrackingLookup,
  TrackingState,
} from './keyword-import-plan';
import { KeywordTracker } from './keyword-tracker';
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
    private readonly tracker: KeywordTracker,
    private readonly quota: QuotaService,
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
    return this.result(planned, imported, false);
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

  private async write(
    app: KeywordApp,
    additions: readonly Addition[],
  ): Promise<number> {
    if (additions.length === 0) {
      return 0;
    }
    const ids = await this.keywordIdsOf(app, additions);
    const located = additions.flatMap((addition) => {
      const keywordId = ids.get(
        pairKey(addition.candidate.country, addition.candidate.text),
      );
      return keywordId ? [{ addition, keywordId }] : [];
    });
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
      await this.tracker.claimForManual(
        tx,
        app.id,
        located.map(({ keywordId }) => keywordId),
      );
      imported = added.count + reactivated.count;
    });
    for (const { keywordId } of located) {
      await this.tracker.enqueueFirstScore(keywordId, app);
    }
    return imported;
  }

  private async keywordIdsOf(
    app: KeywordApp,
    additions: readonly Addition[],
  ): Promise<Map<string, string>> {
    const textsByCountry = new Map<string, string[]>();
    for (const { candidate } of additions) {
      const texts = textsByCountry.get(candidate.country) ?? [];
      texts.push(candidate.text);
      textsByCountry.set(candidate.country, texts);
    }
    const lookups = await Promise.all(
      [...textsByCountry].map(async ([country, texts]) => {
        const idByText = await this.tracker.keywordIdMap(
          texts,
          app.store,
          country,
        );
        return [...idByText].map(
          ([text, id]) => [pairKey(country, text), id] as const,
        );
      }),
    );
    return new Map(lookups.flat());
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
