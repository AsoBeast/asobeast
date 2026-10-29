import { NotFoundException } from '@nestjs/common';
import { Store } from '@prisma/client';
import { UnknownStorefrontError } from '@asobeast/shared';
import { QuotaService } from '../auth/quota.service';
import { PrismaService } from '../prisma/prisma.service';
import { FirstPositionChecks } from './first-position-checks';
import { KeywordBulkService } from './keyword-bulk.service';
import { KeywordTracker } from './keyword-tracker';
import { MarketListingRequests } from './market-listing.requests';

const app = {
  id: 'app1',
  workspaceId: 'ws',
  store: Store.APP_STORE,
  country: 'us',
  storeAppId: '1',
};

const row = (keywordId: string, active: boolean, country = 'us') => ({
  keywordId,
  active,
  keyword: { store: Store.APP_STORE, country },
});

const build = (
  tracked: ReturnType<typeof row>[],
  counts: { changed?: number } = {},
) => {
  const tx = {
    trackedKeyword: {
      findMany: jest
        .fn()
        .mockResolvedValue(
          tracked
            .filter((entry) => !entry.active)
            .map(({ keywordId }) => ({ keywordId })),
        ),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
  const prisma = {
    app: { findFirst: jest.fn().mockResolvedValue(app) },
    trackedKeyword: {
      findMany: jest.fn().mockResolvedValue(tracked),
      updateMany: jest
        .fn()
        .mockResolvedValue({ count: counts.changed ?? tracked.length }),
      deleteMany: jest
        .fn()
        .mockResolvedValue({ count: counts.changed ?? tracked.length }),
    },
    keywordField: { findMany: jest.fn(), upsert: jest.fn() },
  };
  const quota = {
    admitKeywordMarkets: jest.fn(
      (write: (client: typeof tx) => Promise<unknown>) => write(tx),
    ),
  };
  const tracker = { claimForManual: jest.fn().mockResolvedValue({ count: 0 }) };
  const listings = { request: jest.fn().mockResolvedValue(0) };
  const checks = { schedule: jest.fn().mockResolvedValue(0) };
  const service = new KeywordBulkService(
    prisma as unknown as PrismaService,
    quota as unknown as QuotaService,
    tracker as unknown as KeywordTracker,
    listings as unknown as MarketListingRequests,
    checks as unknown as FirstPositionChecks,
  );
  return { service, prisma, tx, quota, tracker, listings, checks };
};

describe('KeywordBulkService', () => {
  it('pauses the active rows and counts what changed', async () => {
    const { service, prisma } = build([
      row('a', true),
      row('b', true),
      row('c', true),
    ]);

    const result = await service.apply('app1', {
      action: 'pause',
      keywordIds: ['a', 'b', 'c'],
    });

    expect(prisma.trackedKeyword.updateMany).toHaveBeenCalledWith({
      where: {
        appId: 'app1',
        active: true,
        keywordId: { in: ['a', 'b', 'c'] },
      },
      data: { active: false },
    });
    expect(result).toEqual({
      action: 'pause',
      requested: 3,
      changed: 3,
      unchanged: 0,
      missing: [],
    });
  });

  it('leaves the rows that are already paused alone', async () => {
    const { service } = build(
      [row('a', true), row('b', true), row('c', false)],
      { changed: 2 },
    );

    const result = await service.apply('app1', {
      action: 'pause',
      keywordIds: ['a', 'b', 'c'],
    });

    expect(result).toMatchObject({ changed: 2, unchanged: 1 });
  });

  it('counts a repeated id once', async () => {
    const { service, prisma } = build([row('a', true), row('b', true)]);

    const result = await service.apply('app1', {
      action: 'pause',
      keywordIds: ['a', 'a', 'b'],
    });

    expect(result.requested).toBe(2);
    expect(prisma.trackedKeyword.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { appId: 'app1', keywordId: { in: ['a', 'b'] } },
      }),
    );
  });

  it('reports the ids the app does not track', async () => {
    const { service } = build([row('a', true)]);

    const result = await service.apply('app1', {
      action: 'pause',
      keywordIds: ['a', 'gone'],
    });

    expect(result).toMatchObject({ missing: ['gone'], unchanged: 0 });
  });

  it('untracks only the rows of this app', async () => {
    const { service, prisma } = build([
      row('a', true),
      row('b', false),
      row('c', true),
    ]);

    const result = await service.apply('app1', {
      action: 'untrack',
      keywordIds: ['a', 'b', 'c'],
    });

    expect(prisma.trackedKeyword.deleteMany).toHaveBeenCalledWith({
      where: { appId: 'app1', keywordId: { in: ['a', 'b', 'c'] } },
    });
    expect(result.changed).toBe(3);
  });

  it('never reads or writes a keyword field when it untracks', async () => {
    const { service, prisma } = build([row('a', true), row('b', true)]);

    await service.apply('app1', { action: 'untrack', keywordIds: ['a', 'b'] });

    expect(prisma.keywordField.findMany).not.toHaveBeenCalled();
    expect(prisma.keywordField.upsert).not.toHaveBeenCalled();
  });

  it('resumes the paused rows in one admission and claims them', async () => {
    const { service, tx, quota, tracker } = build(
      [row('a', false), row('b', false), row('c', true)],
      { changed: 2 },
    );

    const result = await service.apply('app1', {
      action: 'resume',
      keywordIds: ['a', 'b', 'c'],
    });

    expect(quota.admitKeywordMarkets).toHaveBeenCalledTimes(1);
    expect(tx.trackedKeyword.findMany).toHaveBeenCalledWith({
      where: { appId: 'app1', active: false, keywordId: { in: ['a', 'b'] } },
      select: { keywordId: true },
    });
    expect(tx.trackedKeyword.updateMany).toHaveBeenCalledWith({
      where: { appId: 'app1', keywordId: { in: ['a', 'b'] } },
      data: { active: true },
    });
    expect(tracker.claimForManual).toHaveBeenCalledWith(tx, 'app1', ['a', 'b']);
    expect(result).toMatchObject({ changed: 2, unchanged: 1 });
  });

  it('schedules the first checks of the resumed keywords after the admission', async () => {
    const { service, quota, checks } = build([
      row('a', false),
      row('b', false),
    ]);

    await service.apply('app1', { action: 'resume', keywordIds: ['a', 'b'] });

    expect(checks.schedule).toHaveBeenCalledWith('app1', ['a', 'b']);
    expect(quota.admitKeywordMarkets.mock.invocationCallOrder[0]).toBeLessThan(
      checks.schedule.mock.invocationCallOrder[0],
    );
  });

  it('asks for the listing of each market once', async () => {
    const { service, listings } = build([
      row('a', false, 'us'),
      row('b', false, 'us'),
      row('c', false, 'pl'),
    ]);

    await service.apply('app1', {
      action: 'resume',
      keywordIds: ['a', 'b', 'c'],
    });

    expect(listings.request.mock.calls).toEqual([
      [app, 'us'],
      [app, 'pl'],
    ]);
  });

  it('neither counts nor queues a row another request resumed meanwhile', async () => {
    const { service, tx, checks, listings } = build([
      row('a', false, 'us'),
      row('b', false, 'pl'),
    ]);
    tx.trackedKeyword.findMany.mockResolvedValueOnce([{ keywordId: 'a' }]);

    const result = await service.apply('app1', {
      action: 'resume',
      keywordIds: ['a', 'b'],
    });

    expect(result).toMatchObject({ changed: 1, unchanged: 1 });
    expect(checks.schedule).toHaveBeenCalledWith('app1', ['a']);
    expect(listings.request.mock.calls).toEqual([[app, 'us']]);
  });

  it('queues nothing when another request resumed every row meanwhile', async () => {
    const { service, tx, checks, listings } = build([row('a', false)]);
    tx.trackedKeyword.findMany.mockResolvedValueOnce([]);

    const result = await service.apply('app1', {
      action: 'resume',
      keywordIds: ['a'],
    });

    expect(result).toMatchObject({ changed: 0, unchanged: 1 });
    expect(checks.schedule).not.toHaveBeenCalled();
    expect(listings.request).not.toHaveBeenCalled();
  });

  it('writes and queues nothing when every row is already active', async () => {
    const { service, quota, checks, listings } = build([
      row('a', true),
      row('b', true),
    ]);

    const result = await service.apply('app1', {
      action: 'resume',
      keywordIds: ['a', 'b'],
    });

    expect(quota.admitKeywordMarkets).not.toHaveBeenCalled();
    expect(checks.schedule).not.toHaveBeenCalled();
    expect(listings.request).not.toHaveBeenCalled();
    expect(result).toMatchObject({ changed: 0, unchanged: 2 });
  });

  it('queues nothing when the admission refuses the resume', async () => {
    const { service, quota, checks, listings } = build([row('a', false)]);
    const refusal = new Error('keyword markets limit reached');
    quota.admitKeywordMarkets.mockRejectedValueOnce(refusal);

    await expect(
      service.apply('app1', { action: 'resume', keywordIds: ['a'] }),
    ).rejects.toBe(refusal);
    expect(checks.schedule).not.toHaveBeenCalled();
    expect(listings.request).not.toHaveBeenCalled();
  });

  it('refuses a market that is no storefront before the admission', async () => {
    const { service, quota } = build([row('a', false, 'zz')]);

    await expect(
      service.apply('app1', { action: 'resume', keywordIds: ['a'] }),
    ).rejects.toBeInstanceOf(UnknownStorefrontError);
    expect(quota.admitKeywordMarkets).not.toHaveBeenCalled();
  });

  it('answers not found for an unknown app before reading any row', async () => {
    const { service, prisma } = build([row('a', true)]);
    prisma.app.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.apply('missing', { action: 'pause', keywordIds: ['a'] }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.trackedKeyword.findMany).not.toHaveBeenCalled();
  });
});
