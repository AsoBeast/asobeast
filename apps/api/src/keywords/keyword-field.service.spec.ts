import { ConfigService } from '@nestjs/config';
import { Store } from '@prisma/client';
import { Queue } from 'bullmq';
import { QuotaService } from '../auth/quota.service';
import { type SecretBox } from '../common/crypto/secret-box';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { KeywordFieldService } from './keyword-field.service';
import { STORE_FIELD_MANAGED } from './keyword-field-managed';
import { FirstPositionChecks } from './first-position-checks';
import { KeywordFieldWriter } from './keyword-field-writer';
import { KeywordTracker } from './keyword-tracker';
import { MarketListingRequests } from './market-listing.requests';

interface TrackedRow {
  keywordId: string;
  source: string;
  active: boolean;
}

interface CreateManyArgs<T> {
  data: T[];
}

interface KeywordFilter {
  keyword?: { is: { text?: { in: string[] } } };
}

interface KeywordLookup {
  text?: { in: string[] };
  OR?: { text?: { in: string[] } }[];
}

interface FindManyArgs {
  where: KeywordFilter & { active?: boolean; source?: string };
}

interface UpdateManyArgs {
  where: KeywordFilter & {
    source?: string;
    active?: boolean;
    keywordId?: string | { in: string[] };
  };
  data: { active?: boolean; source?: string };
}

const matchesKeywordId = (
  keywordId: string,
  filter: UpdateManyArgs['where']['keywordId'],
) => {
  if (filter === undefined) return true;
  if (typeof filter === 'string') return keywordId === filter;
  return filter.in.includes(keywordId);
};

const APP = {
  id: 'app1',
  workspaceId: 'ws1',
  store: Store.APP_STORE,
  country: 'us',
  storeAppId: 'store1',
};

function buildPrisma() {
  const keywordIds = new Map<string, string>();
  const rows: TrackedRow[] = [];
  const textOf = (keywordId: string) =>
    [...keywordIds].find(([, id]) => id === keywordId)?.[0] ?? '';

  const matchesText = (keywordId: string, filter: KeywordFilter) =>
    filter.keyword?.is.text === undefined ||
    filter.keyword.is.text.in.includes(textOf(keywordId));

  const field = { phrases: null as string[] | null };
  const fieldSync = { row: null as { syncedAt: Date } | null };
  const storeConnectionState = { row: null as { id: string } | null };
  const insertedTexts: string[][] = [];
  const client = {
    rows,
    textOf,
    insertedTexts,
    $executeRaw: jest.fn<Promise<number>, unknown[]>(() => Promise.resolve(1)),
    app: {
      findFirst: () => Promise.resolve(APP),
    },
    appSnapshot: { findFirst: () => Promise.resolve(null) },
    keywordMetric: {
      findFirst: () => Promise.resolve(null),
      findMany: () => Promise.resolve([]),
    },
    serpEntry: {
      findFirst: () => Promise.resolve(null),
      findMany: () => Promise.resolve([]),
    },
    keywordFieldSync: { findFirst: () => Promise.resolve(fieldSync.row) },
    storeConnection: {
      findFirst: () => Promise.resolve(storeConnectionState.row),
    },
    keywordField: {
      findMany: () =>
        Promise.resolve(
          field.phrases
            ? [{ localization: 'en-US', phrases: field.phrases }]
            : [],
        ),
      findUnique: () =>
        Promise.resolve(field.phrases ? { phrases: field.phrases } : null),
      upsert: ({ update }: { update: { phrases: string[] } }) => {
        field.phrases = update.phrases;
        return Promise.resolve(field);
      },
      deleteMany: () => {
        const count = field.phrases ? 1 : 0;
        field.phrases = null;
        return Promise.resolve({ count });
      },
    },
    keyword: {
      createMany: ({ data }: CreateManyArgs<{ text: string }>) => {
        insertedTexts.push(data.map(({ text }) => text));
        const created = data.filter(({ text }) => !keywordIds.has(text));
        for (const { text } of created) {
          keywordIds.set(text, `kw${keywordIds.size + 1}`);
        }
        return Promise.resolve({ count: created.length });
      },
      findMany: ({ where }: { where: KeywordLookup }) =>
        Promise.resolve(
          (where.OR ?? [where])
            .flatMap(({ text }) => text?.in ?? [])
            .filter((text) => keywordIds.has(text))
            .map((text) => ({
              id: keywordIds.get(text),
              text,
              country: APP.country,
            })),
        ),
    },
    trackedKeyword: {
      createMany: ({ data }: CreateManyArgs<TrackedRow>) => {
        const created = data.filter(
          (row) =>
            !rows.some((existing) => existing.keywordId === row.keywordId),
        );
        rows.push(
          ...created.map(({ keywordId, source, active }) => ({
            keywordId,
            source,
            active,
          })),
        );
        return Promise.resolve({ count: created.length });
      },
      findMany: ({ where }: FindManyArgs) => {
        const matching = rows.filter(
          (row) =>
            matchesText(row.keywordId, where) &&
            (where.source === undefined || row.source === where.source) &&
            (where.active === undefined || row.active === where.active),
        );
        return Promise.resolve(
          matching.map((row) => ({
            keywordId: row.keywordId,
            source: row.source,
            active: row.active,
            relevance: null,
            createdAt: new Date('2026-10-01T00:00:00.000Z'),
            keyword: {
              text: textOf(row.keywordId),
              country: APP.country,
              rankings: [],
              metrics: [],
            },
          })),
        );
      },
      updateMany: ({ where, data }: UpdateManyArgs) => {
        const matching = rows.filter(
          (row) =>
            (where.source === undefined || row.source === where.source) &&
            (where.active === undefined || row.active === where.active) &&
            matchesText(row.keywordId, where) &&
            matchesKeywordId(row.keywordId, where.keywordId),
        );
        for (const row of matching) {
          row.active = data.active ?? row.active;
          row.source = data.source ?? row.source;
        }
        return Promise.resolve({ count: matching.length });
      },
    },
  };

  const tx = {
    ...client,
    $executeRaw: jest.fn<Promise<number>, unknown[]>(() => Promise.resolve(1)),
  };

  return {
    ...client,
    fieldSync,
    storeConnectionState,
    tx,
    withTransaction: <T>(run: (scoped: typeof tx) => Promise<T>) => run(tx),
  };
}

function buildService(
  prisma: ReturnType<typeof buildPrisma>,
  box: SecretBox | null = null,
) {
  const queue = { add: jest.fn(), addBulk: jest.fn() } as unknown as Queue;
  const writer = new KeywordFieldWriter(
    new KeywordTracker(
      prisma as unknown as PrismaService,
      queue,
      queue,
      new WorkspaceContext(),
    ),
    new QuotaService(
      prisma as unknown as PrismaService,
      new WorkspaceContext(),
      {
        get: (key: string) => (key === 'BILLING_ENABLED' ? false : null),
      } as unknown as ConfigService<Env, true>,
    ),
    { require: () => APP.workspaceId } as unknown as WorkspaceContext,
    { request: jest.fn() } as unknown as MarketListingRequests,
    { schedule: jest.fn() } as unknown as FirstPositionChecks,
  );
  return new KeywordFieldService(
    prisma as unknown as PrismaService,
    writer,
    box,
  );
}

const deactivatedTexts = (prisma: ReturnType<typeof buildPrisma>) =>
  prisma.rows
    .filter((row) => !row.active)
    .map((row) => prisma.textOf(row.keywordId))
    .sort();

describe('KeywordFieldService.setKeywordField deactivation', () => {
  it('deactivates exactly the phrases the shorter field dropped', async () => {
    const prisma = buildPrisma();
    const service = buildService(prisma);

    await service.setKeywordField(APP.id, 'a,b,c');
    const result = await service.setKeywordField(APP.id, 'a,b');

    expect(result.tracked.map((item) => item.text)).toEqual(['a', 'b']);
    expect(deactivatedTexts(prisma)).toEqual(['c']);
    expect(result.charactersUsed).toBe('a,b'.length);
  });

  it('leaves every phrase tracked when the same field is saved again', async () => {
    const prisma = buildPrisma();
    const service = buildService(prisma);

    const first = await service.setKeywordField(APP.id, 'a,b,c');
    const second = await service.setKeywordField(APP.id, 'a,b,c');

    expect(second.tracked.map((item) => item.keywordId)).toEqual(
      first.tracked.map((item) => item.keywordId),
    );
    expect(deactivatedTexts(prisma)).toEqual([]);
    expect(second.charactersUsed).toBe(first.charactersUsed);
  });

  it('deactivates every phrase when the field is cleared', async () => {
    const prisma = buildPrisma();
    const service = buildService(prisma);

    await service.setKeywordField(APP.id, 'a,b,c');
    const cleared = await service.setKeywordField(APP.id, '');

    expect(cleared.tracked).toEqual([]);
    expect(cleared.charactersUsed).toBe(0);
    expect(deactivatedTexts(prisma)).toEqual(['a', 'b', 'c']);
  });
});

describe('KeywordFieldService.setKeywordField writes', () => {
  it('leaves a dropped phrase another write claimed while the save ran', async () => {
    const prisma = buildPrisma();
    const service = buildService(prisma);
    await service.setKeywordField(APP.id, 'a,b');
    const findMany = prisma.trackedKeyword.findMany;
    jest
      .spyOn(prisma.trackedKeyword, 'findMany')
      .mockImplementation(async (args: FindManyArgs) => {
        const rows = await findMany(args);
        if (args.where.source === 'KEYWORD_FIELD') {
          for (const row of prisma.rows) row.source = 'MANUAL';
        }
        return rows;
      });

    await service.setKeywordField(APP.id, 'a');

    expect(deactivatedTexts(prisma)).toEqual([]);
  });

  it('locks the app inside the transaction before it writes a tracked keyword', async () => {
    const prisma = buildPrisma();
    const service = buildService(prisma);
    const createMany = jest.spyOn(prisma.trackedKeyword, 'createMany');

    await service.setKeywordField(APP.id, 'a,b');

    const [lock] = prisma.tx.$executeRaw.mock.calls;
    expect((lock[0] as TemplateStringsArray).join(' ')).toContain(
      'pg_advisory_xact_lock',
    );
    expect(lock).toContain(APP.id);
    expect(lock).not.toContain(APP.workspaceId);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
    expect(prisma.tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      createMany.mock.invocationCallOrder[0],
    );
  });

  it('reactivates a phrase a later save restores', async () => {
    const prisma = buildPrisma();
    const service = buildService(prisma);

    await service.setKeywordField(APP.id, 'a,b,c');
    await service.setKeywordField(APP.id, 'a,b');
    const restored = await service.setKeywordField(APP.id, 'a,b,c');

    expect(restored.tracked.map((item) => item.text)).toEqual(['a', 'b', 'c']);
    expect(deactivatedTexts(prisma)).toEqual([]);
  });

  it('creates keyword rows in text order whatever order the field was typed in', async () => {
    const prisma = buildPrisma();
    const service = buildService(prisma);

    const result = await service.setKeywordField(APP.id, 'delta,alpha,charlie');

    expect(prisma.insertedTexts).toEqual([['alpha', 'charlie', 'delta']]);
    expect(result.tracked.map((item) => item.text)).toEqual([
      'delta',
      'alpha',
      'charlie',
    ]);
  });
});

describe('KeywordFieldService.setKeywordField managed by App Store Connect', () => {
  it('refuses a manual save once the field was imported', async () => {
    const prisma = buildPrisma();
    prisma.fieldSync.row = { syncedAt: new Date() };
    prisma.storeConnectionState.row = { id: 'con1' };
    const service = buildService(prisma, {} as unknown as SecretBox);

    await expect(
      service.setKeywordField(APP.id, 'delta,alpha'),
    ).rejects.toThrow(STORE_FIELD_MANAGED);
  });
});
