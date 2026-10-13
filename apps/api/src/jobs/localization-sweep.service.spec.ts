import { Logger } from '@nestjs/common';
import { Store } from '@prisma/client';
import type { WorkspaceFanOut } from '../common/tenancy/workspace-fanout';
import type { PrismaService } from '../prisma/prisma.service';
import type { LocalizationDetection } from '../apps/localization-detection.service';
import type { ActiveWorkspaces } from './active-workspaces';
import { LocalizationSweep } from './localization-sweep.service';

const build = (request: jest.Mock, workspaces = ['ws_a']) => {
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
  const sweep = new LocalizationSweep(
    { app: { findMany } } as unknown as PrismaService,
    { request } as unknown as LocalizationDetection,
    fanOut as unknown as WorkspaceFanOut,
    {
      forDailyRun: jest.fn().mockResolvedValue(workspaces),
    } as unknown as ActiveWorkspaces,
  );
  return { sweep, findMany, fanOut };
};

describe('LocalizationSweep', () => {
  it('asks for the localizations of every primary app store app without spending', async () => {
    const request = jest
      .fn()
      .mockResolvedValueOnce({ queued: 2, candidates: [] })
      .mockResolvedValueOnce({ queued: 1, candidates: [] });
    const { sweep, findMany } = build(request);

    await expect(sweep.run()).resolves.toBe(3);

    expect(findMany).toHaveBeenCalledWith({
      where: { isCompetitor: false, store: Store.APP_STORE },
      select: { id: true },
    });
    expect(request.mock.calls.map(([id]) => id as string)).toEqual(['a', 'b']);
    const [[, spend]] = request.mock.calls as [[string, () => Promise<void>]];
    await expect(spend()).resolves.toBeUndefined();
  });

  it('sweeps only the workspaces the daily run collects for', async () => {
    const { sweep, fanOut } = build(
      jest.fn().mockResolvedValue({ queued: 0, candidates: [] }),
      ['ws_active'],
    );

    await sweep.run();

    expect(fanOut.eachOf).toHaveBeenCalledWith(
      ['ws_active'],
      expect.any(Function),
    );
  });

  it('sums what every workspace queued', async () => {
    const request = jest.fn().mockResolvedValue({ queued: 1, candidates: [] });
    const { sweep } = build(request, ['ws_a', 'ws_b']);

    await expect(sweep.run()).resolves.toBe(4);
  });

  it('keeps sweeping when one app cannot be probed', async () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const request = jest
      .fn()
      .mockRejectedValueOnce(new Error('redis is down'))
      .mockResolvedValueOnce({ queued: 2, candidates: [] });
    const { sweep } = build(request);

    try {
      await expect(sweep.run()).resolves.toBe(2);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('localizations of a,'),
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
      'workspace ws_a failed its localization sweep: boom',
    );
  });
});
