import { CURRENT_FORMULA_VERSIONS } from '@asobeast/shared';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient, Store } from '@prisma/client';
import {
  ActionGenerationResult,
  ActionsGenerator,
} from '../../src/actions/actions.generator';
import { DEFAULT_WORKSPACE_ID } from '../../src/common/tenancy/default-workspace';
import { DailyBudgetService } from '../../src/jobs/daily-budget.service';
import { asWorkspace } from './tenancy';

export const ACTION_DAY = (offset: number): Date =>
  new Date(Date.UTC(2026, 6, 30) - offset * 86_400_000);

export interface UncoveredKeywordSeed {
  appId: string;
  keywordId: string;
}

export async function seedUncoveredKeyword(
  prisma: PrismaClient,
): Promise<UncoveredKeywordSeed> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "App", "Keyword" RESTART IDENTITY CASCADE',
  );
  const app = await prisma.app.create({
    data: {
      workspaceId: DEFAULT_WORKSPACE_ID,
      store: Store.APP_STORE,
      storeAppId: '111',
      country: 'us',
      name: 'Budget Planner',
    },
  });
  await prisma.appSnapshot.create({
    data: {
      appId: app.id,
      title: 'Budget Planner',
      subtitle: 'Money',
      description: 'Track spending.',
      version: '4.2.0',
      raw: {},
      capturedAt: ACTION_DAY(1),
    },
  });
  const keyword = await prisma.keyword.create({
    data: { text: 'expense tracker', store: Store.APP_STORE, country: 'us' },
  });
  await prisma.trackedKeyword.create({
    data: {
      appId: app.id,
      keywordId: keyword.id,
      source: 'MANUAL',
      active: true,
      relevance: 90,
    },
  });
  await prisma.keywordMetric.create({
    data: {
      keywordId: keyword.id,
      date: ACTION_DAY(1),
      traffic: 8,
      difficulty: 3,
      formulaVersion: CURRENT_FORMULA_VERSIONS.APP_STORE,
    },
  });
  return { appId: app.id, keywordId: keyword.id };
}

export async function generateActionsAt(
  app: INestApplication,
  now: Date,
): Promise<ActionGenerationResult> {
  const budget = await asWorkspace(app, () =>
    app.get(DailyBudgetService).estimate(),
  );
  return asWorkspace(app, () =>
    app.get(ActionsGenerator).generateForWorkspace(budget, now),
  );
}
