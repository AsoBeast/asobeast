import { Store } from '@prisma/client';
import { QuotaService } from '../auth/quota.service';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { KeywordFieldWriter } from './keyword-field-writer';
import { pairKey } from './keyword-import';
import { KeywordTracker } from './keyword-tracker';
import { MarketListingRequests } from './market-listing.requests';

const APP = {
  id: 'app1',
  workspaceId: 'ws1',
  store: Store.APP_STORE,
  country: 'us',
  storeAppId: 'store1',
};

const build = (stored: string[] = []) => {
  const events: string[] = [];
  const tx = {
    $executeRaw: jest.fn<Promise<number>, unknown[]>(() => {
      events.push('field lock');
      return Promise.resolve(1);
    }),
    keywordField: {
      findUnique: jest.fn(() =>
        Promise.resolve(stored.length > 0 ? { phrases: stored } : null),
      ),
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    trackedKeyword: {
      findMany: jest.fn().mockResolvedValue([]),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    appLocalization: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const quota = {
    admitKeywordMarkets: jest.fn(
      async (write: (client: typeof tx) => Promise<unknown>) => {
        events.push('quota admission');
        return write(tx);
      },
    ),
  };
  const tracker = {
    keywordIdsAcrossMarkets: jest.fn(
      (pairs: { text: string; country: string }[]) =>
        Promise.resolve(
          new Map(
            pairs.map(({ text, country }) => [
              pairKey(country, text),
              `${country}:${text}`,
            ]),
          ),
        ),
    ),
    enqueueFirstScores: jest.fn().mockResolvedValue(undefined),
  };
  const listings = { request: jest.fn().mockResolvedValue(0) };
  const writer = new KeywordFieldWriter(
    tracker as unknown as KeywordTracker,
    quota as unknown as QuotaService,
    { require: () => APP.workspaceId } as unknown as WorkspaceContext,
    listings as unknown as MarketListingRequests,
  );
  return { writer, tx, quota, tracker, listings, events };
};

describe('KeywordFieldWriter', () => {
  it('tracks every phrase in every market it is given', async () => {
    const { writer, tx } = build();

    await writer.save({
      app: APP,
      localization: 'es-MX',
      phrases: ['habito', 'metas'],
      markets: ['us', 'mx'],
    });

    const ids = ['us:habito', 'us:metas', 'mx:habito', 'mx:metas'];
    expect(tx.trackedKeyword.createMany).toHaveBeenCalledWith({
      data: ids.map((keywordId) => ({
        appId: APP.id,
        keywordId,
        source: 'KEYWORD_FIELD',
        active: true,
      })),
      skipDuplicates: true,
    });
    expect(tx.trackedKeyword.updateMany).toHaveBeenCalledWith({
      where: { appId: APP.id, active: false, keywordId: { in: ids } },
      data: { active: true },
    });
  });

  it('asks for the listing of each market that tracked a keyword and of no other', async () => {
    const tracked = build();
    await tracked.writer.save({
      app: APP,
      localization: 'es-MX',
      phrases: ['habito'],
      markets: ['us', 'mx'],
    });
    expect(tracked.listings.request.mock.calls).toEqual([
      [APP, 'us'],
      [APP, 'mx'],
    ]);

    const empty = build(['habito']);
    await empty.writer.save({
      app: APP,
      localization: 'es-MX',
      phrases: [],
      markets: ['us', 'mx'],
    });
    expect(empty.listings.request).not.toHaveBeenCalled();
  });

  it('stores the phrases and tracks nothing when no market is given', async () => {
    const { writer, tx, tracker } = build();

    const result = await writer.save({
      app: APP,
      localization: 'es-MX',
      phrases: ['habito'],
      markets: [],
    });

    expect(tx.keywordField.upsert).toHaveBeenCalledTimes(1);
    expect(tracker.keywordIdsAcrossMarkets).not.toHaveBeenCalled();
    expect(tx.trackedKeyword.createMany).not.toHaveBeenCalled();
    expect(result).toEqual({ keywordIds: [], trackedIn: [] });
  });

  it('resolves every market in one lookup, in the order given', async () => {
    const { writer, tracker } = build();

    await writer.save({
      app: APP,
      localization: 'es-MX',
      phrases: ['habito'],
      markets: ['mx', 'us', 'mx'],
    });

    expect(tracker.keywordIdsAcrossMarkets).toHaveBeenCalledTimes(1);
    expect(tracker.keywordIdsAcrossMarkets).toHaveBeenCalledWith(
      [
        { text: 'habito', country: 'mx' },
        { text: 'habito', country: 'us' },
      ],
      APP.store,
    );
  });

  it('takes the field lock inside the quota admission', async () => {
    const { writer, tx, events } = build();

    await writer.save({
      app: APP,
      localization: 'en-US',
      phrases: ['habit'],
      markets: ['us'],
    });

    expect(events).toEqual(['quota admission', 'field lock']);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    const [strings, ...values] = tx.$executeRaw.mock.calls[0] as [
      TemplateStringsArray,
      ...unknown[],
    ];
    expect(strings.join('')).toContain('pg_advisory_xact_lock');
    expect(values).toContain(APP.id);
  });

  it('answers the keyword ids and the markets it tracked in', async () => {
    const { writer } = build();

    await expect(
      writer.save({
        app: APP,
        localization: 'es-MX',
        phrases: ['habito'],
        markets: ['us', 'mx'],
      }),
    ).resolves.toEqual({
      keywordIds: ['us:habito', 'mx:habito'],
      trackedIn: ['us', 'mx'],
    });
  });

  it('queues the first score of every keyword after the transaction', async () => {
    const { writer, tx, tracker } = build();

    await writer.save({
      app: APP,
      localization: 'es-MX',
      phrases: ['habito'],
      markets: ['us', 'mx'],
    });

    expect(tracker.enqueueFirstScores.mock.calls).toEqual([
      [['us:habito', 'mx:habito'], APP],
    ]);
    expect(
      tracker.enqueueFirstScores.mock.invocationCallOrder[0],
    ).toBeGreaterThan(
      Math.max(...tx.trackedKeyword.createMany.mock.invocationCallOrder),
    );
  });

  it('untracks a dropped phrase in every market that reads the localization and no other', async () => {
    const { writer, tx } = build(['habito', 'metas']);
    tx.trackedKeyword.findMany.mockResolvedValue([
      { keywordId: 'k1', keyword: { text: 'metas', country: 'mx' } },
      { keywordId: 'k2', keyword: { text: 'metas', country: 'de' } },
    ]);

    await writer.save({
      app: APP,
      localization: 'es-MX',
      phrases: ['habito'],
      markets: ['mx'],
    });

    const untracked = tx.trackedKeyword.updateMany.mock.calls.filter(
      ([args]) => (args as { data: { active: boolean } }).data.active === false,
    );
    expect(untracked).toEqual([
      [
        {
          where: {
            appId: APP.id,
            active: true,
            source: 'KEYWORD_FIELD',
            keywordId: { in: ['k1'] },
          },
          data: { active: false },
        },
      ],
    ]);
  });

  it('records a localization other than the home one as manual inside the transaction', async () => {
    const { writer, tx } = build();

    await writer.save({
      app: APP,
      localization: 'es-MX',
      phrases: ['habito'],
      markets: ['us'],
    });

    expect(tx.appLocalization.createMany).toHaveBeenCalledTimes(1);
    expect(tx.appLocalization.createMany).toHaveBeenCalledWith({
      data: [
        {
          appId: 'app1',
          workspaceId: 'ws1',
          localization: 'es-MX',
          origin: 'manual',
        },
      ],
      skipDuplicates: true,
    });
    const recordedAt =
      tx.appLocalization.createMany.mock.invocationCallOrder[0];
    expect(recordedAt).toBeGreaterThan(
      tx.$executeRaw.mock.invocationCallOrder[0],
    );
    expect(recordedAt).toBeLessThan(
      tx.trackedKeyword.createMany.mock.invocationCallOrder[0],
    );
  });

  it('does not record the home localization', async () => {
    const { writer, tx } = build();

    await writer.save({
      app: APP,
      localization: 'en-US',
      phrases: ['habit'],
      markets: ['us'],
    });

    expect(tx.appLocalization.createMany).not.toHaveBeenCalled();
  });

  it('does not record an emptied field', async () => {
    const { writer, tx } = build(['habito']);

    await writer.save({
      app: APP,
      localization: 'es-MX',
      phrases: [],
      markets: ['us'],
    });

    expect(tx.appLocalization.createMany).not.toHaveBeenCalled();
  });

  it('treats English (U.K.) as the home localization of a country that is no storefront', async () => {
    const { writer, tx } = build();

    await writer.save({
      app: { ...APP, country: 'zz' },
      localization: 'en-GB',
      phrases: ['habit'],
      markets: ['zz'],
    });

    expect(tx.appLocalization.createMany).not.toHaveBeenCalled();
  });

  describe('remove', () => {
    const rowsOf = (...rows: [string, string, string][]) =>
      rows.map(([keywordId, text, country]) => ({
        keywordId,
        keyword: { text, country },
      }));

    it('empties the field and deletes the localization row in one admission', async () => {
      const { writer, tx, quota } = build(['habito', 'metas']);

      await writer.remove(APP, 'es-MX');

      expect(quota.admitKeywordMarkets).toHaveBeenCalledTimes(1);
      const where = { where: { appId: 'app1', localization: 'es-MX' } };
      expect(tx.keywordField.deleteMany).toHaveBeenCalledWith(where);
      expect(tx.appLocalization.deleteMany).toHaveBeenCalledWith(where);
    });

    it('takes the field lock inside the quota admission', async () => {
      const { writer, events } = build(['habito']);

      await writer.remove(APP, 'es-MX');

      expect(events).toEqual(['quota admission', 'field lock']);
    });

    it('untracks every previous phrase in every market that reads the localization', async () => {
      const { writer, tx } = build(['habito', 'metas']);
      tx.trackedKeyword.findMany.mockResolvedValue(
        rowsOf(
          ['k1', 'metas', 'mx'],
          ['k2', 'habito', 'us'],
          ['k3', 'metas', 'de'],
        ),
      );

      await writer.remove(APP, 'es-MX');

      expect(tx.trackedKeyword.updateMany).toHaveBeenCalledTimes(1);
      expect(tx.trackedKeyword.updateMany).toHaveBeenCalledWith({
        where: {
          appId: APP.id,
          active: true,
          source: 'KEYWORD_FIELD',
          keywordId: { in: ['k1', 'k2'] },
        },
        data: { active: false },
      });
    });

    it('keeps a phrase another saved field of the market still holds', async () => {
      const { writer, tx } = build(['habito', 'metas']);
      tx.trackedKeyword.findMany.mockResolvedValue(
        rowsOf(
          ['k1', 'metas', 'mx'],
          ['k2', 'habito', 'us'],
          ['k3', 'metas', 'de'],
        ),
      );
      tx.keywordField.findMany.mockResolvedValue([
        { localization: 'en-US', phrases: ['habito'] },
      ]);

      await writer.remove(APP, 'es-MX');

      expect(tx.trackedKeyword.updateMany).toHaveBeenCalledWith({
        where: {
          appId: APP.id,
          active: true,
          source: 'KEYWORD_FIELD',
          keywordId: { in: ['k1'] },
        },
        data: { active: false },
      });
    });

    it('touches no tracked keyword when the field was already empty', async () => {
      const { writer, tx } = build([]);

      await writer.remove(APP, 'es-MX');

      expect(tx.trackedKeyword.findMany).not.toHaveBeenCalled();
      expect(tx.trackedKeyword.updateMany).not.toHaveBeenCalled();
      expect(tx.appLocalization.deleteMany).toHaveBeenCalled();
    });
  });
});
