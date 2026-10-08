import { Store } from '@prisma/client';
import { ClassifiedRow, ImportCandidate, pairKey } from './keyword-import';
import {
  costOf,
  planImport,
  summarize,
  TrackingState,
} from './keyword-import-plan';

const candidate = (
  index: number,
  text: string,
  country = 'us',
): ClassifiedRow => ({
  kind: 'candidate',
  candidate: {
    index,
    text,
    country,
    tags: [],
    note: null,
  } satisfies ImportCandidate,
});

const tracking = (
  entries: Record<string, TrackingState>,
): ReadonlyMap<string, TrackingState> => new Map(Object.entries(entries));

const state = (
  own: TrackingState['own'],
  elsewhere = false,
): TrackingState => ({
  own,
  elsewhere,
});

const statuses = (
  rows: ClassifiedRow[],
  lookup = tracking({}),
  room = null as number | null,
) => planImport(rows, lookup, room).results.map((result) => result.status);

describe('planImport', () => {
  it('plans a phrase nobody tracks as new and opening a market', () => {
    const plan = planImport([candidate(0, 'habit')], tracking({}), null);

    expect(plan.results).toEqual([
      { index: 0, keyword: 'habit', country: 'us', status: 'new' },
    ]);
    expect(plan.additions).toMatchObject([
      { status: 'new', opensMarket: true },
    ]);
  });

  it('skips a phrase the app already tracks and adds nothing', () => {
    const plan = planImport(
      [candidate(0, 'habit')],
      tracking({ [pairKey('us', 'habit')]: state('active') }),
      0,
    );

    expect(plan.results[0].status).toBe('tracked');
    expect(plan.additions).toEqual([]);
  });

  it('resumes a paused phrase and counts the market it reopens', () => {
    const plan = planImport(
      [candidate(0, 'habit')],
      tracking({ [pairKey('us', 'habit')]: state('paused') }),
      null,
    );

    expect(plan.results[0].status).toBe('resume');
    expect(plan.additions[0].opensMarket).toBe(true);
  });

  it('resumes a paused phrase another app of the workspace tracks without opening a market', () => {
    const plan = planImport(
      [candidate(0, 'habit')],
      tracking({ [pairKey('us', 'habit')]: state('paused', true) }),
      null,
    );

    expect(plan.additions[0]).toMatchObject({
      status: 'resume',
      opensMarket: false,
    });
  });

  it('never refuses for room a phrase another app already tracks', () => {
    const plan = planImport(
      [candidate(0, 'habit'), candidate(1, 'streak')],
      tracking({ [pairKey('us', 'habit')]: state(null, true) }),
      0,
    );

    expect(plan.results.map((result) => result.status)).toEqual([
      'new',
      'overQuota',
    ]);
    expect(plan.additions[0].opensMarket).toBe(false);
  });

  it('fills the room in file order and refuses the rest', () => {
    const rows = ['a1', 'a2', 'a3', 'a4'].map((text, index) =>
      candidate(index, text),
    );

    expect(statuses(rows, tracking({}), 2)).toEqual([
      'new',
      'new',
      'overQuota',
      'overQuota',
    ]);
  });

  it('plans every row when no limit applies', () => {
    const rows = ['a1', 'a2', 'a3'].map((text, index) =>
      candidate(index, text),
    );

    expect(statuses(rows, tracking({}), null)).toEqual(['new', 'new', 'new']);
  });

  it('passes invalid and duplicate rows through without spending room', () => {
    const rows: ClassifiedRow[] = [
      {
        kind: 'invalid',
        index: 0,
        keyword: '',
        country: 'us',
        reason: 'empty',
        message: 'Keyword must not be empty',
      },
      {
        kind: 'duplicate',
        index: 1,
        keyword: 'habit',
        country: 'us',
        duplicateOf: 2,
      },
      candidate(2, 'habit'),
    ];

    const plan = planImport(rows, tracking({}), 1);

    expect(plan.results.map((result) => result.status)).toEqual([
      'invalid',
      'duplicate',
      'new',
    ]);
    expect(plan.results[0]).toMatchObject({
      reason: 'empty',
      message: 'Keyword must not be empty',
    });
    expect(plan.results[1]).toMatchObject({ duplicateOf: 2 });
  });

  it('keeps the results in the order of the file', () => {
    const rows = [candidate(0, 'a1'), candidate(1, 'a2'), candidate(2, 'a3')];

    expect(
      planImport(rows, tracking({}), 1).results.map((result) => result.index),
    ).toEqual([0, 1, 2]);
  });
});

describe('summarize and costOf', () => {
  const rows = [
    candidate(0, 'a1'),
    candidate(1, 'a2'),
    candidate(2, 'a3'),
    candidate(3, 'a4'),
  ];
  const plan = planImport(
    rows,
    tracking({
      [pairKey('us', 'a2')]: state('active'),
      [pairKey('us', 'a3')]: state(null, true),
    }),
    1,
  );

  it('counts every row under exactly one status', () => {
    expect(summarize(plan.results)).toEqual({
      rows: 4,
      new: 2,
      resume: 0,
      tracked: 1,
      duplicate: 0,
      invalid: 0,
      overQuota: 1,
    });
  });

  it('prices only the rows that open a market, per store', () => {
    expect(costOf(plan.additions, Store.APP_STORE)).toEqual({
      store: Store.APP_STORE,
      keywordMarkets: 1,
      dailyRequests: 1,
    });
    expect(costOf(plan.additions, Store.GOOGLE_PLAY)).toEqual({
      store: Store.GOOGLE_PLAY,
      keywordMarkets: 1,
      dailyRequests: 8,
    });
  });
});
