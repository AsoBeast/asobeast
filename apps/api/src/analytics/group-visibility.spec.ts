import { RANK_DEPTH, visibility } from '@asobeast/shared';
import {
  GroupMember,
  groupAggregates,
  groupVisibility,
  groupVisibilityPoints,
  Ranking,
  TrackedRow,
  windowVisibility,
} from './analytics.support';

const DAY_13 = new Date('2026-07-13T00:00:00Z');
const DAY_06 = new Date('2026-07-06T00:00:00Z');
const DAY_05 = new Date('2026-07-05T00:00:00Z');

const row = (
  keywordId: string,
  traffic: number,
  captures: Ranking[],
): TrackedRow => ({
  keywordId,
  source: 'MANUAL',
  relevance: null,
  keyword: {
    text: keywordId,
    country: 'us',
    metrics: [{ traffic, difficulty: 10, date: captures[0].date }],
    rankings: [...captures].sort((a, b) => b.date.getTime() - a.date.getTime()),
  },
});

const member = (
  appId: string,
  rows: TrackedRow[],
  referenceDate: Date | null,
): GroupMember => ({
  appId,
  group: { id: 'grp_1', name: 'Habit' },
  rows,
  referenceDate,
});

describe('groupVisibility', () => {
  it('scores each member at its own capture date when captures drift apart', () => {
    const ios = member(
      'ios',
      [row('k_ios', 10, [{ position: 1, depth: RANK_DEPTH, date: DAY_13 }])],
      DAY_13,
    );
    const android = member(
      'android',
      [
        row('k_android', 10, [
          { position: 1, depth: RANK_DEPTH, date: DAY_06 },
        ]),
      ],
      DAY_06,
    );
    const [group] = groupAggregates([ios, android]);

    const blended = groupVisibility(group.members);

    expect(windowVisibility(ios.rows, ios.referenceDate).current).toBe(100);
    expect(windowVisibility(android.rows, android.referenceDate).current).toBe(
      100,
    );
    expect(blended.current).toBe(100);
  });

  it('blends members captured on the same date by traffic weight', () => {
    const ios = member(
      'ios',
      [row('k_ios', 10, [{ position: 1, depth: RANK_DEPTH, date: DAY_13 }])],
      DAY_13,
    );
    const android = member(
      'android',
      [row('k_android', 5, [{ position: 3, depth: RANK_DEPTH, date: DAY_13 }])],
      DAY_13,
    );
    const [group] = groupAggregates([ios, android]);

    expect(groupVisibility(group.members).current).toBeCloseTo(83.3, 1);
  });

  it('degrades to the only scored member when another has no rankings', () => {
    const ios = member(
      'ios',
      [row('k_ios', 10, [{ position: 1, depth: RANK_DEPTH, date: DAY_13 }])],
      DAY_13,
    );
    const android = member('android', [], null);
    const [group] = groupAggregates([ios, android]);

    expect(groupVisibility(group.members).current).toBe(
      windowVisibility(ios.rows, ios.referenceDate).current,
    );
  });

  it('reports no visibility when no member has ever been captured', () => {
    const [group] = groupAggregates([
      member('ios', [], null),
      member('android', [], null),
    ]);

    expect(groupVisibility(group.members)).toEqual({
      current: 0,
      delta7d: null,
    });
  });

  it('derives delta7d from each member own seven-day baseline', () => {
    const ios = member(
      'ios',
      [
        row('k_ios', 10, [
          { position: 1, depth: RANK_DEPTH, date: DAY_13 },
          { position: 3, depth: RANK_DEPTH, date: DAY_06 },
        ]),
      ],
      DAY_13,
    );
    const [group] = groupAggregates([ios]);

    const blended = groupVisibility(group.members);

    expect(blended.current).toBe(100);
    expect(blended.delta7d).toBe(50);
  });

  it('leaves delta7d null without a baseline capture', () => {
    const ios = member(
      'ios',
      [row('k_ios', 10, [{ position: 1, depth: RANK_DEPTH, date: DAY_13 }])],
      DAY_13,
    );
    const [group] = groupAggregates([ios]);

    expect(groupVisibility(group.members).delta7d).toBeNull();
  });

  it('leaves a member without a baseline check out of the group change', () => {
    const ios = member(
      'ios',
      [
        row('k_ios', 10, [
          { position: 1, depth: RANK_DEPTH, date: DAY_13 },
          { position: 3, depth: RANK_DEPTH, date: DAY_06 },
        ]),
      ],
      DAY_13,
    );
    const android = member(
      'android',
      [
        row('k_android', 10, [
          { position: 1, depth: RANK_DEPTH, date: DAY_13 },
        ]),
      ],
      DAY_13,
    );
    const [group] = groupAggregates([ios, android]);

    expect(groupVisibility(group.members).delta7d).toBe(50);
  });
});

describe('groupVisibilityPoints', () => {
  it('aligns each member history to its own reference date', () => {
    const ios = member(
      'ios',
      [row('k_ios', 10, [{ position: 1, depth: RANK_DEPTH, date: DAY_13 }])],
      DAY_13,
    );
    const android = member(
      'android',
      [
        row('k_android', 10, [
          { position: 3, depth: RANK_DEPTH, date: DAY_06 },
        ]),
      ],
      DAY_06,
    );
    const [group] = groupAggregates([ios, android]);

    expect(groupVisibilityPoints(group.members)).toEqual([
      { date: '2026-07-13', visibility: 75 },
    ]);
    expect(groupVisibilityPoints(group.members).at(-1)?.visibility).toBe(
      groupVisibility(group.members).current,
    );
  });

  it('blends members that share a capture date', () => {
    const ios = member(
      'ios',
      [row('k_ios', 10, [{ position: 1, depth: RANK_DEPTH, date: DAY_13 }])],
      DAY_13,
    );
    const android = member(
      'android',
      [row('k_android', 5, [{ position: 3, depth: RANK_DEPTH, date: DAY_13 }])],
      DAY_13,
    );
    const [group] = groupAggregates([ios, android]);

    const [point] = groupVisibilityPoints(group.members);
    expect(point.date).toBe('2026-07-13');
    expect(point.visibility).toBeCloseTo(83.3, 1);
  });
});

const scored = (
  keywordId: string,
  metrics: Array<[traffic: number, scoredOn: Date]>,
  captures: Ranking[],
): TrackedRow => {
  const base = row(keywordId, 0, captures);
  return {
    ...base,
    keyword: {
      ...base.keyword,
      metrics: metrics.map(([traffic, date]) => ({
        traffic,
        difficulty: 10,
        date,
      })),
    },
  };
};

const twoKeywords = (baselineOfB: Date): TrackedRow[] => [
  scored(
    'a',
    [[10, DAY_05]],
    [
      { position: 4, depth: RANK_DEPTH, date: DAY_06 },
      { position: 3, depth: RANK_DEPTH, date: DAY_13 },
    ],
  ),
  scored(
    'b',
    [[20, DAY_05]],
    [
      { position: 5, depth: RANK_DEPTH, date: baselineOfB },
      { position: 2, depth: RANK_DEPTH, date: DAY_13 },
    ],
  ),
];

describe('the baseline of a visibility change', () => {
  it('reads a keyword checked the day before like one checked on the day', () => {
    expect(windowVisibility(twoKeywords(DAY_05), DAY_13).delta7d).toBe(
      windowVisibility(twoKeywords(DAY_06), DAY_13).delta7d,
    );
  });

  it('reads a group member the same way', () => {
    const [partial] = groupAggregates([
      member('ios', twoKeywords(DAY_05), DAY_13),
    ]);
    const [whole] = groupAggregates([
      member('ios', twoKeywords(DAY_06), DAY_13),
    ]);

    expect(groupVisibility(partial.members).delta7d).toBe(
      groupVisibility(whole.members).delta7d,
    );
  });

  it('weights a keyword by the popularity scored on or before its own check', () => {
    const rows = [
      scored(
        'a',
        [[10, DAY_05]],
        [
          { position: 4, depth: RANK_DEPTH, date: DAY_06 },
          { position: 3, depth: RANK_DEPTH, date: DAY_13 },
        ],
      ),
      scored(
        'b',
        [
          [60, DAY_06],
          [20, DAY_05],
        ],
        [
          { position: 5, depth: RANK_DEPTH, date: DAY_05 },
          { position: 2, depth: RANK_DEPTH, date: DAY_13 },
        ],
      ),
    ];
    const { current, delta7d } = windowVisibility(rows, DAY_13);
    const before = visibility([
      { traffic: 10, position: 4 },
      { traffic: 20, position: 5 },
    ]);

    expect(delta7d).toBe(Math.round((current - before) * 10) / 10);
  });
});
