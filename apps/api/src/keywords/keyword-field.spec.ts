import { ConfigService } from '@nestjs/config';
import { Store } from '@prisma/client';
import { Queue } from 'bullmq';
import { QuotaService } from '../auth/quota.service';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { KeywordsService } from './keywords.service';

interface TrackedRow {
  keywordId: string;
  source: string;
  active: boolean;
}

interface CreateManyArgs<T> {
  data: T[];
}

interface FindManyArgs {
  where: { active?: boolean };
}

interface UpdateManyArgs {
  where: {
    source?: string;
    active?: boolean;
    keywordId: string | { in: string[] } | { notIn: string[] };
  };
  data: { active?: boolean; source?: string };
}

const matchesKeywordId = (
  keywordId: string,
  filter: UpdateManyArgs['where']['keywordId'],
) => {
  if (typeof filter === 'string') return keywordId === filter;
  if ('in' in filter) return filter.in.includes(keywordId);
  return !filter.notIn.includes(keywordId);
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

  const insertedTexts: string[][] = [];
  const client = {
    rows,
    textOf,
    insertedTexts,
    $executeRaw: jest.fn<Promise<number>, unknown[]>(() => Promise.resolve(1)),
    app: { findFirst: () => Promise.resolve(APP) },
    appSnapshot: { findFirst: () => Promise.resolve(null) },
    keywordMetric: { findFirst: () => Promise.resolve(null) },
    serpEntry: {
      findFirst: () => Promise.resolve(null),
      findMany: () => Promise.resolve([]),
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
      findMany: ({ where }: { where: { text: { in: string[] } } }) =>
        Promise.resolve(
          where.text.in
            .filter((text) => keywordIds.has(text))
            .map((text) => ({ id: keywordIds.get(text), text })),
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
            row.source === 'KEYWORD_FIELD' &&
            (where.active === undefined || row.active === where.active),
        );
        return Promise.resolve(
          matching.map((row) => ({
            keywordId: row.keywordId,
            source: row.source,
            active: row.active,
            relevance: null,
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
    tx,
    withTransaction: <T>(run: (scoped: typeof tx) => Promise<T>) => run(tx),
  };
}

function buildService(prisma: ReturnType<typeof buildPrisma>) {
  const queue = { add: jest.fn() } as unknown as Queue;
  return new KeywordsService(
    prisma as unknown as PrismaService,
    queue,
    queue,
    new QuotaService(
      prisma as unknown as PrismaService,
      new WorkspaceContext(),
      {
        get: () => false,
      } as unknown as ConfigService<Env, true>,
    ),
    new WorkspaceContext(),
  );
}

const deactivatedTexts = (prisma: ReturnType<typeof buildPrisma>) =>
  prisma.rows
    .filter((row) => !row.active)
    .map((row) => prisma.textOf(row.keywordId))
    .sort();

describe('KeywordsService.setKeywordField deactivation', () => {
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

describe('KeywordsService.setKeywordField writes', () => {
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
});
