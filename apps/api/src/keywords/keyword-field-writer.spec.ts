import { Store } from '@prisma/client';
import { QuotaService } from '../auth/quota.service';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { KeywordFieldWriter } from './keyword-field-writer';
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
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    appLocalization: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
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
    keywordIdsFor: jest.fn((texts: string[], ...target: [Store, string]) =>
      Promise.resolve(texts.map((text) => `${target[1]}:${text}`)),
    ),
    track: jest
      .fn<Promise<void>, [unknown, { keywordId: string }, unknown]>()
      .mockResolvedValue(undefined),
    enqueueFirstScore: jest.fn().mockResolvedValue(undefined),
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
    const { writer, tracker } = build();

    await writer.save({
      app: APP,
      localization: 'es-MX',
      phrases: ['habito', 'metas'],
      markets: ['us', 'mx'],
    });

    expect(tracker.track.mock.calls.map(([, row]) => row.keywordId)).toEqual([
      'us:habito',
      'us:metas',
      'mx:habito',
      'mx:metas',
    ]);
    for (const [, row] of tracker.track.mock.calls) {
      expect(row).toMatchObject({ source: 'KEYWORD_FIELD', active: true });
    }
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
    expect(tracker.keywordIdsFor).not.toHaveBeenCalled();
    expect(tracker.track).not.toHaveBeenCalled();
    expect(result).toEqual({ keywordIds: [], trackedIn: [] });
  });

  it('resolves the keywords once per market, in the order given', async () => {
    const { writer, tracker } = build();

    await writer.save({
      app: APP,
      localization: 'es-MX',
      phrases: ['habito'],
      markets: ['mx', 'us', 'mx'],
    });

    expect(tracker.keywordIdsFor.mock.calls.map((call) => call[2])).toEqual([
      'mx',
      'us',
    ]);
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
    const { writer, tracker } = build();

    await writer.save({
      app: APP,
      localization: 'es-MX',
      phrases: ['habito'],
      markets: ['us', 'mx'],
    });

    expect(tracker.enqueueFirstScore.mock.calls).toEqual([
      ['us:habito', APP],
      ['mx:habito', APP],
    ]);
    expect(
      tracker.enqueueFirstScore.mock.invocationCallOrder[0],
    ).toBeGreaterThan(Math.max(...tracker.track.mock.invocationCallOrder));
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

    expect(tx.trackedKeyword.updateMany).toHaveBeenCalledTimes(1);
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

  it('records a localization other than the home one as manual inside the transaction', async () => {
    const { writer, tx, tracker } = build();

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
    expect(recordedAt).toBeLessThan(tracker.track.mock.invocationCallOrder[0]);
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
});
