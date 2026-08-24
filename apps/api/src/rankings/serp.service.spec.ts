import { NotFoundException } from '@nestjs/common';
import { Store } from '@prisma/client';
import { TrackedKeywordAccess } from '../keywords/tracked-keyword.access';
import { PrismaService } from '../prisma/prisma.service';
import { SerpService } from './serp.service';

describe('SerpService.serp', () => {
  const setup = (options?: {
    keyword?: unknown;
    entries?: unknown[];
    latest?: { date: Date } | null;
    apps?: unknown[];
  }) => {
    const keyword =
      options && 'keyword' in options
        ? options.keyword
        : {
            id: 'kw1',
            text: 'habit tracker',
            store: Store.APP_STORE,
            country: 'us',
          };
    const requireKeyword = jest.fn((keywordId: string) =>
      keyword
        ? Promise.resolve(keyword)
        : Promise.reject(
            new NotFoundException(`Keyword ${keywordId} not found`),
          ),
    );
    const trackedKeywords = {
      require: requireKeyword,
    } as unknown as TrackedKeywordAccess;
    const prisma = {
      serpEntry: {
        findFirst: jest
          .fn()
          .mockResolvedValue(
            options && 'latest' in options
              ? options.latest
              : { date: new Date('2026-07-01T00:00:00.000Z') },
          ),
        findMany: jest.fn().mockResolvedValue(options?.entries ?? []),
      },
      app: {
        findMany: jest.fn().mockResolvedValue(options?.apps ?? []),
      },
    };
    const service = new SerpService(
      prisma as unknown as PrismaService,
      trackedKeywords,
    );
    return { service, prisma, requireKeyword };
  };

  it('throws when the caller does not track the keyword', async () => {
    const { service } = setup({ keyword: null });
    await expect(service.serp('missing', {})).rejects.toThrow(
      'Keyword missing not found',
    );
  });

  it('authorizes the keyword before reading any serp entry', async () => {
    const { service, prisma, requireKeyword } = setup();
    await service.serp('kw1', {});
    expect(requireKeyword).toHaveBeenCalledWith('kw1');
    expect(prisma.serpEntry.findFirst).toHaveBeenCalled();
  });

  it('returns an empty snapshot with null date when never checked', async () => {
    const { service } = setup({ latest: null });
    const snapshot = await service.serp('kw1', {});
    expect(snapshot).toEqual({
      keywordId: 'kw1',
      text: 'habit tracker',
      date: null,
      entries: [],
    });
  });

  it('annotates self, competitor and unknown apps', async () => {
    const { service } = setup({
      entries: [
        {
          position: 1,
          storeAppId: 'self-store',
          title: 'You',
          developer: 'Me',
          ratingAvg: 4.5,
          ratingCount: 100,
        },
        {
          position: 2,
          storeAppId: 'rival-store',
          title: 'Rival',
          developer: 'Them',
          ratingAvg: 4,
          ratingCount: 50,
        },
        {
          position: 3,
          storeAppId: 'unknown-store',
          title: 'Stranger',
          developer: null,
          ratingAvg: null,
          ratingCount: null,
        },
      ],
      apps: [
        { id: 'app1', storeAppId: 'self-store', isCompetitor: false },
        { id: 'app2', storeAppId: 'rival-store', isCompetitor: true },
      ],
    });

    const snapshot = await service.serp('kw1', {});

    expect(snapshot.date).toBe('2026-07-01');
    expect(snapshot.entries[0]).toMatchObject({
      appId: 'app1',
      isCompetitor: false,
    });
    expect(snapshot.entries[1]).toMatchObject({
      appId: 'app2',
      isCompetitor: true,
    });
    expect(snapshot.entries[2]).toMatchObject({
      appId: null,
      isCompetitor: false,
    });
  });
});
