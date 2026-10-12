import { Store } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { pairKey } from './keyword-import';
import { loadTrackingStates } from './keyword-tracking-state';

const APP = { id: 'app1', store: Store.APP_STORE };

const row = (
  appId: string,
  active: boolean,
  text: string,
  country: string,
) => ({
  appId,
  active,
  keyword: { text, country },
});

const clientReturning = (rows: ReturnType<typeof row>[]) => {
  const findMany = jest.fn().mockResolvedValue(rows);
  return {
    client: { trackedKeyword: { findMany } } as unknown as PrismaService,
    findMany,
  };
};

describe('loadTrackingStates', () => {
  it('answers an empty lookup without a query when there are no pairs', async () => {
    const { client, findMany } = clientReturning([]);

    await expect(loadTrackingStates(client, APP, [])).resolves.toEqual(
      new Map(),
    );
    expect(findMany).not.toHaveBeenCalled();
  });

  it("folds own active, own paused and another app's active rows into one state per phrase and market", async () => {
    const { client } = clientReturning([
      row('app1', true, 'habit', 'us'),
      row('app1', false, 'streak', 'us'),
      row('app2', true, 'streak', 'us'),
      row('app2', true, 'habit', 'mx'),
    ]);

    const states = await loadTrackingStates(client, APP, [
      { text: 'habit', country: 'us' },
      { text: 'streak', country: 'us' },
      { text: 'habit', country: 'mx' },
    ]);

    expect(Object.fromEntries(states)).toEqual({
      [pairKey('us', 'habit')]: { own: 'active', elsewhere: false },
      [pairKey('us', 'streak')]: { own: 'paused', elsewhere: true },
      [pairKey('mx', 'habit')]: { own: null, elsewhere: true },
    });
  });

  it('ignores a paused row of another app', async () => {
    const { client } = clientReturning([row('app2', false, 'habit', 'us')]);

    const states = await loadTrackingStates(client, APP, [
      { text: 'habit', country: 'us' },
    ]);

    expect(states.get(pairKey('us', 'habit'))).toEqual({
      own: null,
      elsewhere: false,
    });
  });

  it('asks only for the store, texts and countries of the pairs', async () => {
    const { client, findMany } = clientReturning([]);

    await loadTrackingStates(client, APP, [
      { text: 'habit', country: 'us' },
      { text: 'streak', country: 'us' },
      { text: 'habit', country: 'mx' },
    ]);

    expect(findMany).toHaveBeenCalledWith({
      where: {
        keyword: {
          is: {
            store: Store.APP_STORE,
            text: { in: ['habit', 'streak'] },
            country: { in: ['us', 'mx'] },
          },
        },
      },
      select: {
        appId: true,
        active: true,
        keyword: { select: { text: true, country: true } },
      },
    });
  });
});
