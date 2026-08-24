import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PLAN_LIMITS, QuotaDetail, SELF_HOSTED_LIMITS } from '@asobeast/shared';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { QuotaExceededError } from './quota.errors';
import { QuotaService } from './quota.service';

const WORKSPACE = 'ws_quota';

const DAY_MS = 24 * 60 * 60_000;
const past = new Date(Date.now() - DAY_MS);
const future = new Date(Date.now() + DAY_MS);

interface Stored {
  apps: number;
  competitors: number;
  markets: number;
  plan: string;
  trialEndsAt: Date | null;
  planExpiresAt: Date | null;
}

describe('QuotaService', () => {
  const build = (billingEnabled: boolean, over: Partial<Stored> = {}) => {
    const stored: Stored = {
      apps: 0,
      competitors: 0,
      markets: 0,
      plan: 'premium',
      trialEndsAt: null,
      planExpiresAt: null,
      ...over,
    };
    const executeRaw = jest.fn<Promise<number>, unknown[]>(() =>
      Promise.resolve(1),
    );
    const appCount = jest.fn(
      (args: { where: { isCompetitor?: boolean } }): Promise<number> =>
        Promise.resolve(
          args.where.isCompetitor === true ? stored.competitors : stored.apps,
        ),
    );
    const client = {
      app: { count: appCount },
      workspace: {
        findFirst: jest.fn(() =>
          Promise.resolve({
            plan: stored.plan,
            trialEndsAt: stored.trialEndsAt,
            planExpiresAt: stored.planExpiresAt,
          }),
        ),
      },
      $queryRaw: jest.fn(() =>
        Promise.resolve([{ markets: BigInt(stored.markets) }]),
      ),
      $executeRaw: executeRaw,
    };
    const tx = client as unknown as Prisma.TransactionClient;
    const prisma = {
      ...client,
      withTransaction: <T>(
        run: (inner: Prisma.TransactionClient) => Promise<T>,
      ) => run(tx),
    } as unknown as PrismaService;

    const workspace = new WorkspaceContext();
    const quota = new QuotaService(prisma, workspace, {
      get: () => billingEnabled,
    } as unknown as ConfigService<Env, true>);

    return {
      quota,
      stored,
      tx,
      appCount,
      executeRaw,
      scoped: <T>(work: () => Promise<T>) => workspace.run(WORKSPACE, work),
    };
  };

  const detailOf = async (
    work: () => Promise<unknown>,
  ): Promise<QuotaDetail> => {
    try {
      await work();
    } catch (error) {
      if (error instanceof QuotaExceededError) return error.detail;
      throw error;
    }
    throw new Error('expected the quota to reject');
  };

  it('leaves a self hosted instance without app or keyword limits', async () => {
    const { quota, tx, appCount, scoped } = build(false, { apps: 500 });

    await expect(
      scoped(() => quota.admitApp()(tx, () => Promise.resolve('imported'))),
    ).resolves.toBe('imported');
    expect(appCount).not.toHaveBeenCalled();
  });

  it('admits an app while the plan has room', async () => {
    const { quota, stored, tx, scoped } = build(true, { apps: 4 });

    await expect(
      scoped(() =>
        quota.admitApp()(tx, () => {
          stored.apps += 1;
          return Promise.resolve('imported');
        }),
      ),
    ).resolves.toBe('imported');
  });

  it('serializes the workspace before it writes', async () => {
    const { quota, tx, executeRaw, scoped } = build(true);

    await scoped(() => quota.admitApp()(tx, () => Promise.resolve(null)));

    const sql = (executeRaw.mock.calls[0][0] as TemplateStringsArray).join(' ');
    expect(sql).toContain('pg_advisory_xact_lock');
    expect(executeRaw.mock.calls[0]).toContain(`${WORKSPACE}~apps~`);
  });

  it('names the limit, the usage and the upgrade path when an app is refused', async () => {
    const { quota, stored, tx, scoped } = build(true, { apps: 5 });

    await expect(
      detailOf(() =>
        scoped(() =>
          quota.admitApp()(tx, () => {
            stored.apps += 1;
            return Promise.resolve(null);
          }),
        ),
      ),
    ).resolves.toEqual({
      resource: 'apps',
      plan: 'indie',
      limit: 5,
      used: 5,
      requested: 1,
      upgradeTo: 'ultimate',
    });
  });

  it('refuses the second write at the last free slot, having counted the first', async () => {
    const { quota, stored, tx, scoped } = build(true, { apps: 4 });
    const importOne = () =>
      quota.admitApp()(tx, () => {
        stored.apps += 1;
        return Promise.resolve(null);
      });

    await scoped(importOne);

    await expect(detailOf(() => scoped(importOne))).resolves.toMatchObject({
      used: 5,
      limit: 5,
    });
  });

  it('admits a write that consumes nothing even past the limit', async () => {
    const { quota, tx, scoped } = build(true, { apps: 9 });

    await expect(
      scoped(() => quota.admitApp()(tx, () => Promise.resolve('refreshed'))),
    ).resolves.toBe('refreshed');
  });

  it('counts keyword-market pairs, not phrases', async () => {
    const { quota, stored, scoped } = build(true, { markets: 1000 });

    await expect(
      detailOf(() =>
        scoped(() =>
          quota.admitKeywordMarkets(() => {
            stored.markets += 1;
            return Promise.resolve(null);
          }),
        ),
      ),
    ).resolves.toMatchObject({ resource: 'keywordMarkets', used: 1000 });
  });

  it('rejects a bulk add as a whole rather than filling to the limit', async () => {
    const { quota, stored, scoped } = build(true, { markets: 995 });

    await expect(
      detailOf(() =>
        scoped(() =>
          quota.admitKeywordMarkets(() => {
            stored.markets += 10;
            return Promise.resolve(null);
          }),
        ),
      ),
    ).resolves.toMatchObject({ used: 995, requested: 10, limit: 1000 });
  });

  it('gives an ultimate workspace the larger limits', async () => {
    const { quota, stored, tx, scoped } = build(true, {
      apps: 40,
      plan: 'ultimate',
    });

    await expect(
      scoped(() =>
        quota.admitApp()(tx, () => {
          stored.apps += 1;
          return Promise.resolve('imported');
        }),
      ),
    ).resolves.toBe('imported');
  });

  it('caps competitors even on a self hosted instance', async () => {
    const { quota, stored, tx, scoped } = build(false, { competitors: 10 });

    await expect(
      detailOf(() =>
        scoped(() =>
          quota.admitCompetitor('a1')(tx, () => {
            stored.competitors += 1;
            return Promise.resolve(null);
          }),
        ),
      ),
    ).resolves.toMatchObject({
      resource: 'competitors',
      limit: 10,
      used: 10,
    });
  });

  it('refuses at the limit before a store request is spent on the import', async () => {
    const { quota, scoped } = build(true, { apps: 5 });

    await expect(
      detailOf(() => scoped(() => quota.assertRoom('apps'))),
    ).resolves.toMatchObject({ resource: 'apps', used: 5, limit: 5 });
  });

  it('lets the import through the pre-check while a slot is free', async () => {
    const { quota, scoped } = build(true, { apps: 4 });

    await expect(
      scoped(() => quota.assertRoom('apps')),
    ).resolves.toBeUndefined();
  });

  it('skips the pre-check on a self hosted instance, except for competitors', async () => {
    const { quota, appCount, scoped } = build(false, {
      apps: 500,
      competitors: 10,
    });

    await expect(
      scoped(() => quota.assertRoom('apps')),
    ).resolves.toBeUndefined();
    expect(appCount).not.toHaveBeenCalled();

    await expect(
      detailOf(() => scoped(() => quota.assertRoom('competitors', 'a1'))),
    ).resolves.toMatchObject({ resource: 'competitors', used: 10 });
  });

  it('reports usage against the plan', async () => {
    const { quota, scoped } = build(true, { apps: 2, markets: 1 });

    await expect(scoped(() => quota.usage())).resolves.toEqual({
      plan: 'indie',
      limits: PLAN_LIMITS.indie,
      apps: 2,
      keywordMarkets: 1,
    });
  });

  it('runs a trialing workspace at the indie limits it is sold as', async () => {
    const { quota, scoped } = build(true, {
      plan: 'free',
      trialEndsAt: future,
      apps: 4,
    });

    await expect(scoped(() => quota.limitFor('apps'))).resolves.toBe(
      PLAN_LIMITS.indie.apps,
    );
    await expect(
      scoped(() => quota.assertRoom('apps')),
    ).resolves.toBeUndefined();
  });

  it('drops a lapsed paid workspace to the free limits, not the tier it left', async () => {
    const { quota, scoped } = build(true, {
      plan: 'ultimate',
      planExpiresAt: past,
    });

    await expect(
      detailOf(() => scoped(() => quota.assertRoom('apps'))),
    ).resolves.toMatchObject({ plan: 'free', limit: 0, upgradeTo: 'indie' });
  });

  it('reads every limit from the plan definition it names', async () => {
    const { quota, scoped } = build(true, { plan: 'ultimate' });

    await expect(scoped(() => quota.limitsOf())).resolves.toBe(
      PLAN_LIMITS.ultimate,
    );
  });

  it('reports unlimited as null rather than a large number', async () => {
    const { quota, scoped } = build(false);

    await expect(scoped(() => quota.limitFor('apps'))).resolves.toBeNull();
    await expect(
      scoped(() => quota.limitFor('keywordMarkets')),
    ).resolves.toBeNull();
    await expect(scoped(() => quota.limitFor('competitors'))).resolves.toBe(
      SELF_HOSTED_LIMITS.competitorsPerApp,
    );
  });

  it('offers no upgrade path on a self hosted instance', async () => {
    const { quota, stored, tx, scoped } = build(false, { competitors: 10 });

    await expect(
      detailOf(() =>
        scoped(() =>
          quota.admitCompetitor('a1')(tx, () => {
            stored.competitors += 1;
            return Promise.resolve(null);
          }),
        ),
      ),
    ).resolves.toMatchObject({ upgradeTo: null });
  });
});
