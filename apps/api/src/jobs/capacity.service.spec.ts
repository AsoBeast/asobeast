import { DailyBudget } from '@asobeast/shared';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { WorkspaceFanOut } from '../common/tenancy/workspace-fanout';
import { ActiveWorkspaces } from './active-workspaces';
import { CapacityService } from './capacity.service';
import { DailyBudgetService } from './daily-budget.service';

const budgetOf = (total: number, capacityPerDay: number) =>
  ({ total, capacityPerDay }) as DailyBudget;

describe('CapacityService', () => {
  const workspace = new WorkspaceContext();
  const estimate = jest.fn<Promise<DailyBudget>, []>();
  const forDailyRun = jest.fn<Promise<string[]>, []>();

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
  );

  beforeEach(() => {
    forDailyRun.mockReset().mockResolvedValue([]);
    estimate.mockReset().mockResolvedValue(budgetOf(0, 0));
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
