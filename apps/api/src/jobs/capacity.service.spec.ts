import { DailyBudget, Store, StoreDailyBudget } from '@asobeast/shared';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { WorkspaceFanOut } from '../common/tenancy/workspace-fanout';
import { ActiveWorkspaces } from './active-workspaces';
import { CapacityService } from './capacity.service';
import { DailyBudgetService } from './daily-budget.service';
import { PrismaService } from '../prisma/prisma.service';

const budgetOf = (
  total: number,
  capacityPerDay: number,
  stores: StoreDailyBudget[] = [],
) => ({ total, capacityPerDay, stores }) as DailyBudget;

const storeBudget = (
  store: Store,
  total: number,
  capacityPerDay: number,
): StoreDailyBudget => ({
  store,
  apps: 0,
  keywords: 0,
  categories: 0,
  reviews: 0,
  total,
  capacityPerDay,
  utilization: 0,
});

describe('CapacityService', () => {
  const workspace = new WorkspaceContext();
  const estimate = jest.fn<Promise<DailyBudget>, []>();
  const forDailyRun = jest.fn<Promise<string[]>, []>();
  const findMany = jest.fn<Promise<{ id: string; name: string }[]>, []>();

  const fanOut = {
    eachOf: async <T>(workspaceIds: string[], work: () => Promise<T>) => {
      const results: T[] = [];
      for (const id of workspaceIds) {
        results.push(await workspace.run(id, work));
      }
      return { results, failures: [] };
    },
  } as unknown as WorkspaceFanOut;

  const service = new CapacityService(
    fanOut,
    workspace,
    { forDailyRun } as unknown as ActiveWorkspaces,
    { estimate } as unknown as DailyBudgetService,
    { workspace: { findMany } } as unknown as PrismaService,
    {
      becauseThisWorkIsNotOwnedByOneWorkspace: <T>(
        _: string,
        work: () => Promise<T>,
      ) => work(),
    } as unknown as CrossTenantAccess,
  );

  beforeEach(() => {
    forDailyRun.mockReset().mockResolvedValue([]);
    estimate.mockReset().mockResolvedValue(budgetOf(0, 0));
    findMany.mockReset().mockResolvedValue([]);
  });

  it('reports an idle instance without dividing by zero', async () => {
    await expect(service.report()).resolves.toEqual({
      requestsPerDay: 0,
      capacityPerDay: 0,
      utilization: 0,
      workspaces: [],
    });
  });

  it('sums demand across workspaces against one shared capacity', async () => {
    forDailyRun.mockResolvedValue(['ws_a', 'ws_b']);
    estimate
      .mockResolvedValueOnce(budgetOf(300, 1_000))
      .mockResolvedValueOnce(budgetOf(200, 1_000));

    await expect(service.report()).resolves.toMatchObject({
      requestsPerDay: 500,
      capacityPerDay: 1_000,
      utilization: 0.5,
    });
  });

  it('names the workspaces consuming most first', async () => {
    forDailyRun.mockResolvedValue(['ws_small', 'ws_big']);
    estimate
      .mockResolvedValueOnce(budgetOf(10, 1_000))
      .mockResolvedValueOnce(budgetOf(900, 1_000));

    const report = await service.report();

    expect(report.workspaces).toEqual([
      { workspaceId: 'ws_big', requests: 900 },
      { workspaceId: 'ws_small', requests: 10 },
    ]);
  });

  it('labels the top consumers with their workspace names', async () => {
    forDailyRun.mockResolvedValue(['ws_small', 'ws_big']);
    estimate
      .mockResolvedValueOnce(budgetOf(10, 1_000))
      .mockResolvedValueOnce(budgetOf(900, 1_000));
    findMany.mockResolvedValue([{ id: 'ws_big', name: 'Big Apps' }]);

    const report = await service.report();

    expect(report.workspaces).toStrictEqual([
      { workspaceId: 'ws_big', name: 'Big Apps', requests: 900 },
      { workspaceId: 'ws_small', name: undefined, requests: 10 },
    ]);
  });

  it('sums demand per store against the shared store capacity', async () => {
    forDailyRun.mockResolvedValue(['ws_a', 'ws_b']);
    estimate
      .mockResolvedValueOnce(
        budgetOf(100, 21_600, [storeBudget('APP_STORE', 100, 21_600)]),
      )
      .mockResolvedValueOnce(
        budgetOf(50, 21_600, [storeBudget('APP_STORE', 50, 21_600)]),
      );

    const report = await service.report();

    expect(report.stores).toEqual([
      {
        store: 'APP_STORE',
        requestsPerDay: 150,
        capacityPerDay: 21_600,
        utilization: 0.007,
      },
    ]);
  });

  it('lists a store reported by one workspace, in store order', async () => {
    forDailyRun.mockResolvedValue(['ws_play', 'ws_both']);
    estimate
      .mockResolvedValueOnce(
        budgetOf(30, 14_400, [storeBudget('GOOGLE_PLAY', 30, 14_400)]),
      )
      .mockResolvedValueOnce(
        budgetOf(60, 36_000, [
          storeBudget('APP_STORE', 40, 21_600),
          storeBudget('GOOGLE_PLAY', 20, 14_400),
        ]),
      );

    const report = await service.report();

    expect(report.stores).toEqual([
      {
        store: 'APP_STORE',
        requestsPerDay: 40,
        capacityPerDay: 21_600,
        utilization: 0.002,
      },
      {
        store: 'GOOGLE_PLAY',
        requestsPerDay: 50,
        capacityPerDay: 14_400,
        utilization: 0.003,
      },
    ]);
  });

  it('measures each workspace inside its own scope', async () => {
    forDailyRun.mockResolvedValue(['ws_a']);
    const seen: (string | undefined)[] = [];
    estimate.mockImplementation(() => {
      seen.push(workspace.current);
      return Promise.resolve(budgetOf(1, 10));
    });

    await service.report();

    expect(seen).toEqual(['ws_a']);
  });
});
