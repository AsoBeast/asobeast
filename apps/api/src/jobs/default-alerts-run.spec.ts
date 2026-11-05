import { Logger } from '@nestjs/common';
import type { DefaultAlertsService } from '../alerts/default-alerts.service';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { WorkspaceFanOut } from '../common/tenancy/workspace-fanout';
import type { PrismaService } from '../prisma/prisma.service';
import type { ActiveWorkspaces } from './active-workspaces';
import { DefaultAlertsRun } from './default-alerts-run';

describe('DefaultAlertsRun', () => {
  const build = () => {
    const workspace = new WorkspaceContext();
    const createFor = jest.fn(() => {
      const id = workspace.require('a test');
      if (id === 'ws_b') return Promise.reject(new Error('boom'));
      return Promise.resolve(id === 'ws_a' ? 'created' : 'settled');
    });
    const forDailyRun = jest.fn().mockResolvedValue(['ws_a', 'ws_b', 'ws_c']);
    const run = new DefaultAlertsRun(
      { forDailyRun } as unknown as ActiveWorkspaces,
      new WorkspaceFanOut(
        {} as PrismaService,
        workspace,
        new CrossTenantAccess(workspace),
      ),
      { createFor } as unknown as DefaultAlertsService,
    );
    return { run, createFor, forDailyRun };
  };

  it('runs every workspace of the daily roster and counts the outcomes', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const { run, createFor, forDailyRun } = build();

    await expect(run.run('2026-11-04')).resolves.toEqual({
      created: 1,
      unconfirmed: 0,
      skipped: 0,
      settled: 1,
      not_due: 0,
      waiting: 0,
    });
    expect(forDailyRun).toHaveBeenCalledTimes(1);
    expect(createFor).toHaveBeenCalledTimes(3);
    expect(createFor).toHaveBeenCalledWith('2026-11-04');
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('ws_b'),
      expect.anything(),
    );
    error.mockRestore();
  });
});
