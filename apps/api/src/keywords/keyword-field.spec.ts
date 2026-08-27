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
  where: { keywordId: string | { in: string[] } };
  data: { active?: boolean; source?: string };
}

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

  const client = {
    rows,
    textOf,
    app: { findFirst: () => Promise.resolve(APP) },
    appSnapshot: { findFirst: () => Promise.resolve(null) },
    keywordMetric: { findFirst: () => Promise.resolve(null) },
    serpEntry: {
      findFirst: () => Promise.resolve(null),
      findMany: () => Promise.resolve([]),
    },
    keyword: {
      createMany: ({ data }: CreateManyArgs<{ text: string }>) => {
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
        const ids =
          typeof where.keywordId === 'string'
            ? [where.keywordId]
            : where.keywordId.in;
        for (const row of rows.filter((row) => ids.includes(row.keywordId))) {
          row.active = data.active ?? row.active;
          row.source = data.source ?? row.source;
        }
        return Promise.resolve({ count: ids.length });
      },
    },
  };

  return {
    ...client,
    withTransaction: <T>(run: (tx: typeof client) => Promise<T>) => run(client),
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
