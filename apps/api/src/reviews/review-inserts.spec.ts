import { Store } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { ReviewResult } from '../store-providers/types';
import { ReviewInserts } from './review-inserts';
import type {
  ReviewSpikeAlerts,
  SpikeThemes,
} from './review-spike-alerts.service';

const APP = {
  id: 'app1',
  name: 'Mine',
  store: Store.APP_STORE,
  country: 'us',
  iconUrl: null,
};

const THEMES: SpikeThemes = new Map([
  ['2026-11-16', { phrase: 'crash on launch', kind: 'complaint', mentions: 4 }],
]);

const review = (reviewId: string): ReviewResult => ({
  reviewId,
  score: 1,
  text: `review ${reviewId}`,
  updatedAt: new Date('2026-11-16T09:00:00.000Z'),
});

const build = (written: string[]) => {
  const calls: string[] = [];
  const executeRaw = jest.fn((strings: TemplateStringsArray) => {
    calls.push(strings.join('?'));
    return Promise.resolve(1);
  });
  const createManyAndReturn = jest.fn(() => {
    calls.push('insert');
    return Promise.resolve(written.map((reviewId) => ({ reviewId })));
  });
  const tx = { $executeRaw: executeRaw, review: { createManyAndReturn } };
  const withTransaction = jest.fn((run: (client: typeof tx) => unknown) => {
    calls.push('transaction');
    return run(tx);
  });
  const themesFor = jest.fn(() => {
    calls.push('themes');
    return Promise.resolve(THEMES);
  });
  const record = jest.fn(() => {
    calls.push('record');
    return Promise.resolve();
  });
  const inserts = new ReviewInserts(
    { withTransaction } as unknown as PrismaService,
    { themesFor, record } as unknown as ReviewSpikeAlerts,
  );
  return {
    inserts,
    calls,
    tx,
    executeRaw,
    createManyAndReturn,
    withTransaction,
    themesFor,
    record,
  };
};

const batch = (absent: ReviewResult[], judgesSpikes = true) => ({
  app: APP,
  absent,
  checkedAt: null,
  judgesSpikes,
});

describe('ReviewInserts.store', () => {
  it('locks the app before inserting', async () => {
    const { inserts, calls, executeRaw } = build(['a']);

    await inserts.store(batch([review('a')]));

    expect(calls.slice(1, 4)).toEqual([
      'transaction',
      'SELECT pg_advisory_xact_lock(?, hashtext(?))',
      'insert',
    ]);
    expect(executeRaw.mock.calls[0].slice(1)).toEqual([7_461_029, 'app1']);
  });

  it('inserts the absent reviews and returns only those the database wrote', async () => {
    const absent = [review('a'), review('b'), review('c')];
    const { inserts, createManyAndReturn } = build(['a', 'c']);

    const stored = await inserts.store(batch(absent));

    expect(stored).toEqual([absent[0], absent[2]]);
    expect(createManyAndReturn).toHaveBeenCalledWith(
      expect.objectContaining({
        skipDuplicates: true,
        select: { reviewId: true },
      }),
    );
  });

  it('forecasts the themes before the transaction opens', async () => {
    const { inserts, calls } = build(['a']);

    await inserts.store(batch([review('a')]));

    expect(calls.indexOf('themes')).toBeLessThan(calls.indexOf('transaction'));
  });

  it('records the spike with the transaction, the inserted reviews, the themes and one clock', async () => {
    const absent = [review('a'), review('b')];
    const { inserts, tx, themesFor, record } = build(['b']);

    await inserts.store(batch(absent));

    const [, , forecastAt] = themesFor.mock.calls[0] as unknown as [
      unknown,
      unknown,
      Date,
    ];
    expect(record).toHaveBeenCalledWith(tx, {
      app: APP,
      inserted: [absent[1]],
      themes: THEMES,
      now: forecastAt,
    });
  });

  it('neither forecasts nor records during a backfill', async () => {
    const { inserts, calls, themesFor, record } = build(['a']);

    await inserts.store(batch([review('a')], false));

    expect(themesFor).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
    expect(calls).toEqual([
      'transaction',
      'SELECT pg_advisory_xact_lock(?, hashtext(?))',
      'insert',
    ]);
  });

  it('records nothing when the database wrote no row', async () => {
    const { inserts, record } = build([]);

    await expect(inserts.store(batch([review('a')]))).resolves.toEqual([]);
    expect(record).not.toHaveBeenCalled();
  });

  it('opens no transaction when nothing is absent', async () => {
    const { inserts, withTransaction, themesFor } = build([]);

    await expect(inserts.store(batch([]))).resolves.toEqual([]);
    expect(withTransaction).not.toHaveBeenCalled();
    expect(themesFor).not.toHaveBeenCalled();
  });

  it('rejects when the insert fails and records nothing', async () => {
    const { inserts, createManyAndReturn, record } = build([]);
    createManyAndReturn.mockImplementation(() =>
      Promise.reject(new Error('insert refused')),
    );

    await expect(inserts.store(batch([review('a')]))).rejects.toThrow(
      'insert refused',
    );
    expect(record).not.toHaveBeenCalled();
  });
});
