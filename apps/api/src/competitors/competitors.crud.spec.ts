import { BadRequestException } from '@nestjs/common';
import { Store } from '@prisma/client';
import { AppCaptureService } from '../apps/app-capture.service';
import { KeywordsService } from '../keywords/keywords.service';
import { ConfigService } from '@nestjs/config';
import { QuotaService } from '../auth/quota.service';
import { QuotaExceededError } from '../auth/quota.errors';
import { Env } from '../config/env';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { DEFAULT_WORKSPACE_ID } from '../common/tenancy/default-workspace';
import { PrismaService } from '../prisma/prisma.service';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { ProxyEgress } from '../store-providers/egress/proxy-egress.service';
import { CompetitorsService } from './competitors.service';

const passThroughEgress = {
  through: <T>(_store: unknown, _country: unknown, work: () => Promise<T>) =>
    work(),
} as unknown as ProxyEgress;

describe('CompetitorsService.add', () => {
  const buildDeps = (competitorCount: number) => {
    const getApp = jest.fn().mockResolvedValue({
      title: 'Rival',
      iconUrl: 'https://icon',
      subtitle: null,
      summary: null,
      description: 'd',
      ratingAvg: null,
      ratingCount: null,
      installs: null,
      price: null,
      version: null,
      releasedAt: null,
      storeUpdatedAt: null,
      raw: {},
    });
    const created = {
      id: 'comp1',
      store: Store.APP_STORE,
      name: 'Rival',
      iconUrl: 'https://icon',
      isCompetitor: true,
      primaryAppId: 'primary',
    };
    const snapshot = {
      id: 'snap1',
      title: 'Rival',
      subtitle: null,
      summary: null,
      ratingAvg: null,
      ratingCount: null,
      installs: null,
      price: null,
      version: null,
      capturedAt: new Date('2026-07-05T00:00:00Z'),
    };
    const upsert = jest
      .fn<
        Promise<typeof created>,
        [
          {
            create: {
              isCompetitor: boolean;
              primaryAppId?: string;
              country: string;
            };
          },
        ]
      >()
      .mockImplementation(() => {
        competitors += 1;
        return Promise.resolve(created);
      });
    let competitors = competitorCount;
    const findFirst = jest.fn().mockResolvedValue({
      id: 'primary',
      store: Store.APP_STORE,
      country: 'us',
    });
    const findUnique = jest.fn().mockResolvedValue(null);
    const tx = {
      app: {
        upsert,
        findFirst,
        findUnique,
        count: jest.fn(() => Promise.resolve(competitors)),
      },
      appSnapshot: { create: jest.fn().mockResolvedValue(snapshot) },
      workspace: { findFirst: jest.fn().mockResolvedValue({ plan: 'free' }) },
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    const prisma = {
      ...tx,
      app: {
        findFirst,
        findUnique,
        count: jest.fn(() => Promise.resolve(competitors)),
      },
      withTransaction: jest.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
    };
    const registry = { get: () => ({ getApp }) };
    const keywords = { syncFromSnapshot: jest.fn() };
    const workspace = new WorkspaceContext();
    const capture = new AppCaptureService(
      prisma as unknown as PrismaService,
      registry as unknown as StoreProviderRegistry,
      workspace,
      passThroughEgress,
    );
    const service = new CompetitorsService(
      prisma as unknown as PrismaService,
      keywords as unknown as KeywordsService,
      capture,
      new QuotaService(prisma as unknown as PrismaService, workspace, {
        get: () => false,
      } as unknown as ConfigService<Env, true>),
    );
    return { service, prisma, upsert, keywords, getApp, workspace };
  };

  it('creates a competitor row and skips keyword sync', async () => {
    const { service, upsert, keywords, workspace } = buildDeps(0);

    await workspace.run(DEFAULT_WORKSPACE_ID, async () => {
      await service.add('primary', 'https://apps.apple.com/us/app/rival/id999');
    });

    const createArg = upsert.mock.calls[0][0].create;
    expect(createArg.isCompetitor).toBe(true);
    expect(createArg.primaryAppId).toBe('primary');
    expect(createArg.country).toBe('us');
    expect(keywords.syncFromSnapshot).not.toHaveBeenCalled();
  });

  it('rejects a competitor on a different store', async () => {
    const { service } = buildDeps(0);

    await expect(
      service.add(
        'primary',
        'https://play.google.com/store/apps/details?id=com.rival.app',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects once the competitor cap is reached', async () => {
    const { service, workspace } = buildDeps(10);

    await expect(
      workspace.run(DEFAULT_WORKSPACE_ID, () =>
        service.add('primary', 'https://apps.apple.com/us/app/rival/id999'),
      ),
    ).rejects.toBeInstanceOf(QuotaExceededError);
  });
});
