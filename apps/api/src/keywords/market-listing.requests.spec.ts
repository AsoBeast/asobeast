import { Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { JOBS } from '../jobs/jobs.types';
import { PrismaService } from '../prisma/prisma.service';
import { KeywordApp } from './keywords.support';
import { MarketListingRequests } from './market-listing.requests';

const APP: KeywordApp = {
  id: 'primary',
  workspaceId: 'ws_a',
  store: 'APP_STORE',
  country: 'us',
  storeAppId: '111',
};

const buildQueue = () => {
  const stored = new Map<string, { data: unknown }>();
  return {
    add: jest
      .fn<Promise<void>, [string, unknown, { jobId: string }]>()
      .mockImplementation((_name, data, opts) => {
        stored.set(opts.jobId, { data });
        return Promise.resolve();
      }),
    getJob: jest.fn((jobId: string) => Promise.resolve(stored.get(jobId))),
    remove: jest.fn().mockResolvedValue(1),
  };
};

describe('MarketListingRequests', () => {
  const workspace = new WorkspaceContext();
  const findMany = jest.fn();
  const groupBy = jest.fn();
  const prisma = {
    app: { findMany },
    appSnapshot: { groupBy },
  } as unknown as PrismaService;
  let appStoreQueue: ReturnType<typeof buildQueue>;
  let gplayQueue: ReturnType<typeof buildQueue>;
  let requests: MarketListingRequests;

  const request = (market: string) =>
    workspace.run('ws_a', () => requests.request(APP, market));

  const queued = () =>
    appStoreQueue.add.mock.calls.map(([name, data, opts]) => ({
      name,
      appId: (data as { appId: string }).appId,
      country: (data as { country: string }).country,
      jobId: opts.jobId,
    }));

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-27T10:00:00.000Z'));
    findMany
      .mockReset()
      .mockResolvedValue([{ id: 'primary' }, { id: 'rival' }]);
    groupBy.mockReset().mockResolvedValue([]);
    appStoreQueue = buildQueue();
    gplayQueue = buildQueue();
    requests = new MarketListingRequests(
      prisma,
      appStoreQueue as unknown as Queue,
      gplayQueue as unknown as Queue,
      workspace,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('requests the market listing of the app and its competitors', async () => {
    await expect(request('de')).resolves.toBe(2);

    expect(queued()).toEqual([
      {
        name: JOBS.REFRESH_APP,
        appId: 'primary',
        country: 'de',
        jobId: 'refresh~primary~de~2026-07-27',
      },
      {
        name: JOBS.REFRESH_APP,
        appId: 'rival',
        country: 'de',
        jobId: 'refresh~rival~de~2026-07-27',
      },
    ]);
    expect(gplayQueue.add).not.toHaveBeenCalled();
  });

  it('queues nothing for a market that already has a listing', async () => {
    groupBy.mockResolvedValue([{ appId: 'primary' }]);

    await expect(request('de')).resolves.toBe(1);

    expect(queued().map((job) => job.appId)).toEqual(['rival']);
  });

  it('queues nothing for the home market', async () => {
    await expect(request('us')).resolves.toBe(0);

    expect(findMany).not.toHaveBeenCalled();
    expect(groupBy).not.toHaveBeenCalled();
    expect(appStoreQueue.add).not.toHaveBeenCalled();
  });

  it('never fails the caller when the queue is down', async () => {
    const error = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    appStoreQueue.add.mockRejectedValue(new Error('redis unavailable'));

    await expect(request('de')).resolves.toBe(0);

    expect(error).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });
});
