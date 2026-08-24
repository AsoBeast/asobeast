import { PrismaClient, Store } from '@prisma/client';
import { DEFAULT_WORKSPACE_ID } from '../../src/common/tenancy/default-workspace';

export const SCALES = ['small', 'target', 'stress'] as const;
export type Scale = (typeof SCALES)[number];

export interface ScaleShape {
  apps: number;
  keywordsPerApp: number;
  countries: string[];
  stores: Store[];
  historyDays: number;
}

export const SCALE_SHAPES: Record<Scale, ScaleShape> = {
  small: {
    apps: 3,
    keywordsPerApp: 25,
    countries: ['us'],
    stores: [Store.APP_STORE],
    historyDays: 7,
  },
  target: {
    apps: 20,
    keywordsPerApp: 200,
    countries: ['us', 'gb'],
    stores: [Store.APP_STORE, Store.GOOGLE_PLAY],
    historyDays: 90,
  },
  stress: {
    apps: 50,
    keywordsPerApp: 500,
    countries: ['us', 'gb', 'de'],
    stores: [Store.APP_STORE, Store.GOOGLE_PLAY],
    historyDays: 90,
  },
};

const ANCHOR_DATE = Date.UTC(2026, 6, 1);
const CHUNK = 5_000;

function seededInt(seed: string, bound: number): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return Math.abs(hash) % bound;
}

function dayBefore(offset: number): Date {
  return new Date(ANCHOR_DATE - offset * 86_400_000);
}

async function inChunks<T>(
  rows: T[],
  write: (batch: T[]) => Promise<unknown>,
): Promise<void> {
  for (let index = 0; index < rows.length; index += CHUNK) {
    await write(rows.slice(index, index + CHUNK));
  }
}

export interface LoadFixtureSummary {
  scale: Scale;
  apps: number;
  keywords: number;
  trackedKeywords: number;
  rankings: number;
}

export async function loadFixture(
  prisma: PrismaClient,
  scale: Scale,
): Promise<LoadFixtureSummary> {
  const shape = SCALE_SHAPES[scale];

  await prisma.workspace.upsert({
    where: { id: DEFAULT_WORKSPACE_ID },
    update: {},
    create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
  });

  const apps = Array.from({ length: shape.apps }, (_, index) => ({
    id: `load-app-${index}`,
    workspaceId: DEFAULT_WORKSPACE_ID,
    store: shape.stores[index % shape.stores.length],
    storeAppId: `load-store-${index}`,
    country: shape.countries[0],
    name: `Load App ${index}`,
    isCompetitor: false,
  }));
  await prisma.app.createMany({ data: apps, skipDuplicates: true });

  const keywords: {
    id: string;
    text: string;
    store: Store;
    country: string;
  }[] = [];
  const tracked: { appId: string; keywordId: string; source: 'MANUAL' }[] = [];

  for (const app of apps) {
    for (const country of shape.countries) {
      for (let index = 0; index < shape.keywordsPerApp; index += 1) {
        const text = `load term ${app.id} ${index}`;
        const id = `load-kw-${app.id}-${country}-${index}`;
        keywords.push({ id, text, store: app.store, country });
        tracked.push({ appId: app.id, keywordId: id, source: 'MANUAL' });
      }
    }
  }

  await inChunks(keywords, (batch) =>
    prisma.keyword.createMany({ data: batch, skipDuplicates: true }),
  );
  await inChunks(tracked, (batch) =>
    prisma.trackedKeyword.createMany({ data: batch, skipDuplicates: true }),
  );

  let pending: {
    appId: string;
    workspaceId: string;
    keywordId: string;
    date: Date;
    position: number | null;
    depth: number;
  }[] = [];
  let rankingCount = 0;

  const flush = async (): Promise<void> => {
    if (pending.length === 0) return;
    await prisma.keywordRanking.createMany({
      data: pending,
      skipDuplicates: true,
    });
    rankingCount += pending.length;
    pending = [];
  };

  for (const entry of tracked) {
    for (let day = 0; day < shape.historyDays; day += 1) {
      const roll = seededInt(`${entry.keywordId}-${day}`, 240);
      pending.push({
        appId: entry.appId,
        workspaceId: DEFAULT_WORKSPACE_ID,
        keywordId: entry.keywordId,
        date: dayBefore(day),
        position: roll >= 200 ? null : roll + 1,
        depth: 200,
      });
      if (pending.length >= CHUNK) await flush();
    }
  }
  await flush();

  return {
    scale,
    apps: apps.length,
    keywords: keywords.length,
    trackedKeywords: tracked.length,
    rankings: rankingCount,
  };
}

export async function clearFixture(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "App", "Keyword" RESTART IDENTITY CASCADE',
  );
}
