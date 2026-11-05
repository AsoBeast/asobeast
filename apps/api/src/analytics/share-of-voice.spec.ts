import { RANK_DEPTH, UNSCORED_TRAFFIC } from '@asobeast/shared';
import { Ranking, TrackedRow, visibilityAt } from './analytics.support';
import {
  rivalRows,
  shareAt,
  shareOfVoicePoints,
  shareOfVoiceSummary,
} from './share-of-voice';

const D0 = new Date('2026-11-03T00:00:00Z');
const D1 = new Date('2026-11-02T00:00:00Z');
const D2 = new Date('2026-11-01T00:00:00Z');
const D7 = new Date('2026-10-27T00:00:00Z');

const check = (date: Date, position: number | null): Ranking => ({
  date,
  position,
  depth: RANK_DEPTH,
});

const row = (
  keywordId: string,
  traffic: number | null,
  rankings: Ranking[],
): TrackedRow => ({
  keywordId,
  source: 'MANUAL',
  relevance: null,
  keyword: {
    text: keywordId,
    country: 'us',
    metrics: [{ traffic, difficulty: 3, date: D7 }],
    rankings,
  },
});

const TRAFFIC: [string, number][] = [
  ['k1', 8],
  ['k2', 5],
  ['k3', 3],
];

const rowsAt = (
  positions: (number | null)[],
  date = D0,
  traffic: (number | null)[] = TRAFFIC.map(([, value]) => value),
): TrackedRow[] =>
  TRAFFIC.map(([keywordId], index) =>
    row(keywordId, traffic[index], [check(date, positions[index])]),
  );

const rivalAt = (
  rows: TrackedRow[],
  checks: Record<string, Ranking[]>,
): TrackedRow[] => rivalRows(rows, new Map(Object.entries(checks)));

const rivalOf = (
  rows: TrackedRow[],
  positions: (number | null)[],
  date = D0,
): TrackedRow[] =>
  rivalAt(
    rows,
    Object.fromEntries(
      TRAFFIC.map(([keywordId], index) => [
        keywordId,
        [check(date, positions[index])],
      ]),
    ),
  );

describe('shareAt', () => {
  const you = rowsAt([3, 12, null]);
  const rivalA = rivalOf(you, [9, 4, 8]);
  const rivalB = rivalOf(you, [null, null, 2]);

  it('measures the worked example against two competitors', () => {
    expect(visibilityAt(you, D0)).toBe(33.4);
    expect(visibilityAt(rivalA, D0)).toBe(34.4);
    expect(visibilityAt(rivalB, D0)).toBe(11.8);
    expect(shareAt(you, [rivalA, rivalB], D0)).toEqual({
      share: 42,
      counted: 2,
    });
  });

  it('measures the worked example against one competitor', () => {
    expect(shareAt(you, [rivalA], D0)).toEqual({ share: 49.3, counted: 1 });
  });

  it('answers every voice when nobody else ranks', () => {
    const lead = rowsAt([1, 1, 1]);

    expect(shareAt(lead, [rivalOf(lead, [null, null, null])], D0).share).toBe(
      100,
    );
  });

  it('answers a real zero when only the competitor ranks', () => {
    const absent = rowsAt([null, null, null]);

    expect(shareAt(absent, [rivalOf(absent, [1, 1, 1])], D0)).toEqual({
      share: 0,
      counted: 1,
    });
  });

  it('names why nobody can be measured', () => {
    const absent = rowsAt([null, null, null]);

    expect(shareAt(absent, [rivalOf(absent, [null, null, null])], D0)).toEqual({
      share: null,
      counted: 1,
      reason: 'nobodyRanks',
    });
    expect(shareAt([], [[]], D0)).toEqual({
      share: null,
      counted: 0,
      reason: 'nobodyRanks',
    });
  });

  it('names an app without competitors', () => {
    expect(shareAt(you, [], D0)).toEqual({
      share: null,
      counted: 0,
      reason: 'noCompetitors',
    });
  });

  it('counts only the competitors checked that day', () => {
    const elsewhere = rivalOf(you, [1, 1, 1], D1);

    expect(shareAt(you, [elsewhere], D0)).toEqual({
      share: null,
      counted: 0,
      reason: 'notChecked',
    });
    expect(shareAt(you, [elsewhere, rivalA], D0)).toEqual({
      share: 49.3,
      counted: 1,
    });
  });

  it('counts a competitor checked and found nowhere', () => {
    expect(shareAt(you, [rivalOf(you, [null, null, null])], D0)).toEqual({
      share: 100,
      counted: 1,
    });
  });

  it('weighs an unscored keyword as the visibility formula does', () => {
    const unscored = rowsAt([1, null, null], D0, [null, 5, 3]);
    const rival = rivalOf(unscored, [null, 1, null]);
    const total = UNSCORED_TRAFFIC + 5 + 3;
    const yours = Math.round(((UNSCORED_TRAFFIC * 1) / total) * 1000) / 10;
    const theirs = Math.round(((5 * 1) / total) * 1000) / 10;

    expect(shareAt(unscored, [rival], D0).share).toBe(
      Math.round((yours / (yours + theirs)) * 1000) / 10,
    );
  });

  it('rounds to one decimal', () => {
    const half = rowsAt([1, null, null], D0, [1, 1, 1]);
    const rival = rivalOf(half, [null, 1, 1]);

    expect(shareAt(half, [rival], D0).share).toBe(33.3);
  });
});

describe('rivalRows', () => {
  it('swaps in the competitor rankings and leaves the app rows alone', () => {
    const rows = rowsAt([1, 2, 3]);
    const rival = rivalAt(rows, {
      k1: [check(D0, 5)],
      k2: [check(D0, 6)],
    });

    expect(rival.map((entry) => entry.keyword.rankings)).toEqual([
      [check(D0, 5)],
      [check(D0, 6)],
      [],
    ]);
    expect(rows.map((entry) => entry.keyword.rankings)).toEqual([
      [check(D0, 1)],
      [check(D0, 2)],
      [check(D0, 3)],
    ]);
  });
});

describe('shareOfVoiceSummary', () => {
  const twoDays = (now: (number | null)[], before: (number | null)[]) =>
    TRAFFIC.map(([keywordId, traffic], index) =>
      row(keywordId, traffic, [
        check(D0, now[index]),
        check(D7, before[index]),
      ]),
    );
  const rivalTwoDays = (
    rows: TrackedRow[],
    now: (number | null)[],
    before: (number | null)[] | null,
  ) =>
    rivalAt(
      rows,
      Object.fromEntries(
        TRAFFIC.map(([keywordId], index) => [
          keywordId,
          [
            check(D0, now[index]),
            ...(before ? [check(D7, before[index])] : []),
          ],
        ]),
      ),
    );

  it('answers the change over seven days', () => {
    const rows = twoDays([3, 12, null], [1, null, null]);
    const rival = rivalTwoDays(rows, [9, 4, 8], [2, 1, 1]);
    const past = shareAt(rows, [rival], D7).share ?? 0;

    expect(shareOfVoiceSummary(rows, [rival], D0)).toEqual({
      current: 49.3,
      delta7d: Math.round((49.3 - past) * 10) / 10,
      competitors: 1,
    });
  });

  it('answers no change when the app was not checked seven days before', () => {
    const rows = rowsAt([3, 12, null]);

    expect(
      shareOfVoiceSummary(rows, [rivalOf(rows, [9, 4, 8])], D0).delta7d,
    ).toBeNull();
  });

  it('answers no change when nobody ranked seven days before', () => {
    const rows = twoDays([3, 12, null], [null, null, null]);
    const rival = rivalTwoDays(rows, [9, 4, 8], [null, null, null]);

    expect(shareOfVoiceSummary(rows, [rival], D0).delta7d).toBeNull();
  });

  it('measures the past against the competitors checked then', () => {
    const rows = twoDays([3, 12, null], [3, 12, null]);
    const joined = rivalTwoDays(rows, [null, null, 2], null);
    const kept = rivalTwoDays(rows, [9, 4, 8], [9, 4, 8]);

    expect(shareOfVoiceSummary(rows, [kept, joined], D0)).toEqual({
      current: 42,
      delta7d: -7.3,
      competitors: 2,
    });
    expect(shareOfVoiceSummary(rows, [joined], D0).delta7d).toBeNull();
  });

  it.each([
    ['no competitors', [], D0, 'noCompetitors'],
    ['no check of the app', [[]], null, 'notChecked'],
    ['no competitors and no check', [], null, 'noCompetitors'],
  ] as const)('names %s', (_, rivals, date, reason) => {
    expect(shareOfVoiceSummary(rowsAt([3, 12, null]), rivals, date)).toEqual({
      current: null,
      delta7d: null,
      competitors: 0,
      reason,
    });
  });

  it('names a competitor not checked on the reference day', () => {
    const rows = rowsAt([3, 12, null]);

    expect(
      shareOfVoiceSummary(rows, [rivalOf(rows, [1, 1, 1], D1)], D0),
    ).toEqual({
      current: null,
      delta7d: null,
      competitors: 0,
      reason: 'notChecked',
    });
  });

  it('answers no reason beside a share', () => {
    const rows = rowsAt([3, 12, null]);

    expect(
      shareOfVoiceSummary(rows, [rivalOf(rows, [9, 4, 8])], D0),
    ).not.toHaveProperty('reason');
  });
});

describe('shareOfVoicePoints', () => {
  const threeDays = TRAFFIC.map(([keywordId, traffic]) =>
    row(keywordId, traffic, [check(D0, 3), check(D1, 3), check(D2, 3)]),
  );

  it('charts the days a competitor was checked, oldest first', () => {
    const rival = rivalAt(
      threeDays,
      Object.fromEntries(
        TRAFFIC.map(([keywordId]) => [keywordId, [check(D0, 3), check(D1, 3)]]),
      ),
    );

    expect(shareOfVoicePoints(threeDays, [rival])).toEqual([
      { date: '2026-11-02', share: 50, competitors: 1 },
      { date: '2026-11-03', share: 50, competitors: 1 },
    ]);
  });

  it('charts nothing without a competitor', () => {
    expect(shareOfVoicePoints(threeDays, [])).toEqual([]);
  });
});
