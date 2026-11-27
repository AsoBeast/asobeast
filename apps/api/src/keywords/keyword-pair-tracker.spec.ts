import { Store } from '@prisma/client';
import { QuotaService } from '../auth/quota.service';
import { PrismaService } from '../prisma/prisma.service';
import { FirstPositionChecks } from './first-position-checks';
import { KeywordPairTracker } from './keyword-pair-tracker';
import { KeywordTracker } from './keyword-tracker';
import { MarketListingRequests } from './market-listing.requests';

const app = {
  id: 'app1',
  workspaceId: 'ws',
  store: Store.APP_STORE,
  country: 'us',
  storeAppId: '1',
};

const build = () => {
  const tx = {
    trackedKeyword: {
      createMany: jest.fn().mockResolvedValue({ count: 2 }),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
  const prisma = {
    app: { count: jest.fn().mockResolvedValue(1) },
    trackedKeyword: { findMany: jest.fn().mockResolvedValue([]) },
    keyword: { findMany: jest.fn().mockResolvedValue([]) },
    withTransaction: jest.fn((run: (client: typeof tx) => Promise<unknown>) =>
      run(tx),
    ),
  };
  const quota = {
    upgradeFrom: jest.fn(() => null),
    usage: jest.fn().mockResolvedValue({
      plan: 'indie',
      limits: { keywordMarkets: null },
      apps: 0,
      keywordMarkets: 0,
    }),
    admitKeywordMarkets: jest.fn(
      (write: (client: typeof tx) => Promise<unknown>) => write(tx),
    ),
  };
  const tracker = {
    keywordIdsAcrossMarkets: jest.fn(
      (pairs: { text: string; country: string }[]) =>
        Promise.resolve(
          new Map(
            pairs.map(({ text, country }) => [
              `${country}~${text}`,
              `${country}:${text}`,
            ]),
          ),
        ),
    ),
    claimForManual: jest.fn().mockResolvedValue({ count: 0 }),
    enqueueFirstScores: jest.fn().mockResolvedValue(undefined),
  };
  const listings = { request: jest.fn().mockResolvedValue(0) };
  const checks = { schedule: jest.fn().mockResolvedValue(0) };
  const pairs = new KeywordPairTracker(
    prisma as unknown as PrismaService,
    tracker as unknown as KeywordTracker,
    quota as unknown as QuotaService,
    listings as unknown as MarketListingRequests,
    checks as unknown as FirstPositionChecks,
  );
  return { tx, prisma, quota, checks, listings, pairs };
};

describe('KeywordPairTracker', () => {
  it('plans pairs of several markets', async () => {
    const { pairs } = build();

    const { plan } = await pairs.plan(
      app,
      [
        { keyword: 'habit tracker', country: 'gb' },
        { keyword: 'habit tracker', country: 'au' },
      ],
      'us',
    );

    expect(plan.results).toEqual([
      { index: 0, keyword: 'habit tracker', country: 'gb', status: 'new' },
      { index: 1, keyword: 'habit tracker', country: 'au', status: 'new' },
    ]);
    expect(plan.additions).toHaveLength(2);
  });

  it('runs the callback inside the admission after the tracked rows', async () => {
    const { tx, pairs, quota } = build();
    const { plan } = await pairs.plan(app, [{ keyword: 'focus' }], 'us');
    const within = jest.fn(() => {
      expect(tx.trackedKeyword.createMany).toHaveBeenCalled();
      return Promise.resolve();
    });

    await expect(pairs.write(app, plan.additions, within)).resolves.toBe(2);

    expect(quota.admitKeywordMarkets).toHaveBeenCalledTimes(1);
    expect(within).toHaveBeenCalledWith(tx);
  });

  it('runs the callback inside the admission', async () => {
    const { pairs, checks, listings } = build();
    const { plan } = await pairs.plan(app, [{ keyword: 'focus' }], 'us');

    await expect(
      pairs.write(app, plan.additions, () =>
        Promise.reject(new Error('row refused')),
      ),
    ).rejects.toThrow('row refused');

    expect(checks.schedule).not.toHaveBeenCalled();
    expect(listings.request).not.toHaveBeenCalled();
  });

  it('runs the callback in a plain transaction when nothing is added', async () => {
    const { tx, prisma, quota, pairs } = build();
    const within = jest.fn().mockResolvedValue(undefined);

    await expect(pairs.write(app, [], within)).resolves.toBe(0);

    expect(quota.admitKeywordMarkets).not.toHaveBeenCalled();
    expect(prisma.withTransaction).toHaveBeenCalledTimes(1);
    expect(within).toHaveBeenCalledWith(tx);
  });
});
