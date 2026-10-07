import { Store } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QuotaService } from '../auth/quota.service';
import { KeywordImportService } from './keyword-import.service';

const app = {
  id: 'app1',
  workspaceId: 'ws',
  store: Store.APP_STORE,
  country: 'us',
  storeAppId: '1',
};

const trackedRow = (
  appId: string,
  active: boolean,
  text: string,
  country = 'us',
) => ({ appId, active, keyword: { text, country } });

const build = (
  tracked: ReturnType<typeof trackedRow>[],
  usage: { limit: number | null; used: number },
) => {
  const prisma = {
    app: { findFirst: jest.fn().mockResolvedValue(app) },
    trackedKeyword: { findMany: jest.fn().mockResolvedValue(tracked) },
    keyword: { createMany: jest.fn() },
  };
  const quota = {
    enforced: true,
    usage: jest.fn().mockResolvedValue({
      plan: 'indie',
      limits: { keywordMarkets: usage.limit },
      apps: 0,
      keywordMarkets: usage.used,
    }),
  };
  const service = new KeywordImportService(
    prisma as unknown as PrismaService,
    quota as unknown as QuotaService,
  );
  return { prisma, service };
};

describe('KeywordImportService.preview', () => {
  it('folds the tracking of every app of the workspace into one state per phrase and market', async () => {
    const { service } = build(
      [
        trackedRow('app1', true, 'habit'),
        trackedRow('app1', false, 'streak'),
        trackedRow('other', true, 'streak'),
        trackedRow('other', true, 'focus'),
        trackedRow('other', false, 'sleep'),
      ],
      { limit: null, used: 0 },
    );

    const result = await service.preview('app1', {
      rows: ['habit', 'streak', 'focus', 'sleep'].map((keyword) => ({
        keyword,
      })),
    });

    expect(result.results.map((row) => row.status)).toEqual([
      'tracked',
      'resume',
      'new',
      'new',
    ]);
    expect(result.cost.keywordMarkets).toBe(1);
  });

  it('reads the room from the keyword market limit and the usage', async () => {
    const { service } = build([], { limit: 10, used: 8 });

    const result = await service.preview('app1', {
      rows: [{ keyword: 'a1' }, { keyword: 'a2' }, { keyword: 'a3' }],
    });

    expect(result.results.map((row) => row.status)).toEqual([
      'new',
      'new',
      'overQuota',
    ]);
    expect(result.quota).toEqual({
      used: 8,
      limit: 10,
      upgradeTo: 'ultimate',
    });
  });

  it('reports no quota and no refusal when the plan has no keyword limit', async () => {
    const { service } = build([], { limit: null, used: 0 });

    const result = await service.preview('app1', {
      rows: [{ keyword: 'a1' }],
    });

    expect(result.quota).toBeNull();
    expect(result.summary.overQuota).toBe(0);
  });

  it('writes nothing', async () => {
    const { prisma, service } = build([], { limit: null, used: 0 });

    const result = await service.preview('app1', {
      rows: [{ keyword: 'a1' }],
    });

    expect(result).toMatchObject({ dryRun: true, imported: 0 });
    expect(prisma.keyword.createMany).not.toHaveBeenCalled();
  });
});
