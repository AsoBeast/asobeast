import { Injectable } from '@nestjs/common';
import {
  assertStorefront,
  KeywordImportRequest,
  KeywordImportResult,
} from '@asobeast/shared';
import { PrismaService } from '../prisma/prisma.service';
import { costOf, summarize } from './keyword-import-plan';
import { KeywordPairTracker, PairPlan } from './keyword-pair-tracker';
import { ensureApp, KeywordApp } from './keywords.support';

interface PlannedImport extends PairPlan {
  app: KeywordApp;
}

@Injectable()
export class KeywordImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pairs: KeywordPairTracker,
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
    const imported = await this.pairs.write(
      planned.app,
      planned.plan.additions,
    );
    if (!planned.quota || imported === 0) {
      return this.result(planned, imported, false);
    }
    const quota = await this.pairs.quotaAfterWrite();
    return this.result({ ...planned, quota }, imported, false);
  }

  private async planned(
    appId: string,
    request: KeywordImportRequest,
  ): Promise<PlannedImport> {
    const app = await ensureApp(this.prisma, appId);
    const country = request.country ?? app.country;
    assertStorefront(app.store, country);
    return { app, ...(await this.pairs.plan(app, request.rows, country)) };
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
