import { Logger } from '@nestjs/common';
import type { WorkspaceFanOut } from '../common/tenancy/workspace-fanout';
import type { KeywordDiscoveryPlanner } from '../keyword-discovery/discovery-planner.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { ActiveWorkspaces } from './active-workspaces';
import { KeywordDiscoverySweep } from './keyword-discovery-sweep.service';

const build = (plan: jest.Mock, workspaces = ['ws_a']) => {
  const findMany = jest.fn().mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
  const fanOut = {
    eachOf: jest.fn(async (ids: string[], work: () => Promise<number>) => {
      const results: number[] = [];
      for (let index = 0; index < ids.length; index += 1) {
        results.push(await work());
      }
      return { results, failures: [] };
    }),
  };
  const sweep = new KeywordDiscoverySweep(
    { app: { findMany } } as unknown as PrismaService,
    { plan } as unknown as KeywordDiscoveryPlanner,
    fanOut as unknown as WorkspaceFanOut,
    {
      forDailyRun: jest.fn().mockResolvedValue(workspaces),
    } as unknown as ActiveWorkspaces,
  );
  return { sweep, findMany, fanOut };
};

describe('KeywordDiscoverySweep', () => {
  it('plans every primary app that is still listed, of both stores, without spending', async () => {
    const plan = jest
      .fn()
      .mockResolvedValueOnce({ queued: 40, resolved: 2 })
      .mockResolvedValueOnce({ queued: 20, resolved: 0 });
    const { sweep, findMany } = build(plan);

    await expect(sweep.run()).resolves.toBe(60);

    expect(findMany).toHaveBeenCalledWith({
      where: { isCompetitor: false, delistedAt: null },
      select: { id: true },
    });
    expect(plan.mock.calls).toEqual([['a'], ['b']]);
  });

  it('visits only the workspaces the daily run collects for', async () => {
    const { sweep, fanOut } = build(
      jest.fn().mockResolvedValue({ queued: 0, resolved: 0 }),
      ['ws_active'],
    );

    await sweep.run();

    expect(fanOut.eachOf).toHaveBeenCalledWith(
      ['ws_active'],
      expect.any(Function),
    );
  });

  it('keeps planning when one app fails', async () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const plan = jest
      .fn()
      .mockRejectedValueOnce(new Error('redis is down'))
      .mockResolvedValueOnce({ queued: 3, resolved: 0 });
    const { sweep } = build(plan);

    try {
      await expect(sweep.run()).resolves.toBe(3);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('keyword discoveries of a,'),
      );
    } finally {
      warn.mockRestore();
    }
  });

  it('fails the job when a workspace fails', async () => {
    const { sweep, fanOut } = build(jest.fn());
    fanOut.eachOf.mockResolvedValueOnce({
      results: [],
      failures: [{ workspaceId: 'ws_a', error: new Error('boom') }],
    } as never);

    await expect(sweep.run()).rejects.toThrow(
      'workspace ws_a failed its keyword discovery sweep: boom',
    );
  });
});
