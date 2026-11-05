import {
  competitorGapLists,
  GapRow,
  GapScope,
  gapCoverage,
  keywordGapsOf,
  leadsOf,
  RecentChecks,
  threatReadScope,
  threatRows,
  winnableOf,
} from './competitor-gap-lists';
import { CheckSeries } from './competitor-threats';
import { gapEntry, OTHER, PRIMARY, RIVAL } from './competitor-gaps.fixture';

const scope = (
  delisted: readonly string[] = [],
  ids: readonly string[] = [RIVAL, OTHER],
): GapScope => ({
  primaryId: PRIMARY,
  competitors: ids.map((id) => ({ id, delisted: delisted.includes(id) })),
});

const textsOf = (rows: { text: string }[]) => rows.map(({ text }) => text);

const isGap = (entry: GapRow, gapScope = scope()) =>
  keywordGapsOf([entry], gapScope).length === 1;

const isLeadRow = (entry: GapRow, gapScope = scope()) =>
  leadsOf([entry], gapScope).length === 1;

describe('keywordGapsOf', () => {
  it.each([
    ['a competitor at 30 and the app unranked', null, 30, true],
    ['a competitor at 31 and the app unranked', null, 31, false],
    ['the app at 100', 100, 5, false],
    ['the app at 101', 101, 5, true],
    ['the app at 200', 200, 5, true],
    ['nobody ranking', null, null, false],
  ])('judges %s', (_, you, rival, expected) => {
    expect(isGap(gapEntry({ you, positions: { [RIVAL]: rival } }))).toBe(
      expected,
    );
  });

  it('answers the app absent with no distance', () => {
    const [row] = keywordGapsOf(
      [gapEntry({ positions: { [RIVAL]: 5 } })],
      scope(),
    );

    expect(row).toMatchObject({
      yourPosition: null,
      bestCompetitorPosition: 5,
      bestCompetitorId: RIVAL,
      gap: null,
      country: 'us',
    });
  });

  it('names the best of two competitors', () => {
    const [row] = keywordGapsOf(
      [gapEntry({ positions: { [RIVAL]: 40, [OTHER]: 12 } })],
      scope(),
    );

    expect(row).toMatchObject({
      bestCompetitorPosition: 12,
      bestCompetitorId: OTHER,
    });
  });

  it('is no gap when the best competitor is beyond 30', () => {
    expect(isGap(gapEntry({ positions: { [RIVAL]: 31, [OTHER]: 45 } }))).toBe(
      false,
    );
  });

  it('ignores an unchecked competitor and still judges the checked one', () => {
    const entry = gapEntry({
      positions: { [RIVAL]: null, [OTHER]: 5 },
      unchecked: [RIVAL],
    });

    expect(keywordGapsOf([entry], scope())[0]?.bestCompetitorId).toBe(OTHER);
  });

  it('leaves out a keyword the app was never checked on', () => {
    const entry = gapEntry({
      positions: { [RIVAL]: 5 },
      unchecked: [PRIMARY],
    });

    expect(keywordGapsOf([entry], scope())).toEqual([]);
    expect(leadsOf([entry], scope())).toEqual([]);
  });

  it('is no gap when the only competitor ranking is delisted', () => {
    const entry = gapEntry({ positions: { [RIVAL]: 5 } });

    expect(isGap(entry, scope([RIVAL], [RIVAL]))).toBe(false);
  });

  it('keeps one row per market of the same text', () => {
    const rows = keywordGapsOf(
      [
        gapEntry({ keywordId: 'kw-us', positions: { [RIVAL]: 5 } }),
        gapEntry({
          keywordId: 'kw-de',
          country: 'de',
          positions: { [RIVAL]: 5 },
        }),
      ],
      scope(),
    );

    expect(rows.map(({ country }) => country).sort()).toEqual(['de', 'us']);
  });

  it('keeps a stale keyword with the day it was last checked', () => {
    const [row] = keywordGapsOf(
      [
        gapEntry({
          positions: { [RIVAL]: 5 },
          latestCheckedOn: '2026-10-29',
        }),
      ],
      scope(),
    );

    expect(row?.lastCheckedOn).toBe('2026-10-29');
  });

  it('answers no check day without a tracked item', () => {
    const [row] = keywordGapsOf(
      [gapEntry({ positions: { [RIVAL]: 5 }, tracked: false })],
      scope(),
    );

    expect(row?.lastCheckedOn).toBeNull();
  });
});

describe('winnableOf', () => {
  const winnable = (input: Parameters<typeof gapEntry>[0]) =>
    winnableOf(keywordGapsOf([gapEntry(input)], scope())).length === 1;

  it.each([
    [
      'difficulty below popularity',
      { difficulty: 5.9, volume: 60, rival: 5 },
      true,
    ],
    [
      'difficulty equal to popularity',
      { difficulty: 6, volume: 60, rival: 5 },
      false,
    ],
    [
      'difficulty above popularity',
      { difficulty: 6.1, volume: 60, rival: 5 },
      false,
    ],
    [
      'a competitor at 10 on a hard keyword',
      { difficulty: 8, volume: 20, rival: 10 },
      false,
    ],
    [
      'a competitor at 11 on a hard keyword',
      { difficulty: 8, volume: 20, rival: 11 },
      true,
    ],
    [
      'no popularity and a competitor at 10',
      { difficulty: 1, volume: null, rival: 10 },
      false,
    ],
    [
      'no difficulty and a competitor at 11',
      { difficulty: null, volume: 60, rival: 11 },
      true,
    ],
  ])('judges %s', (_, { difficulty, volume, rival }, expected) => {
    expect(
      winnable({ difficulty, volume, positions: { [RIVAL]: rival } }),
    ).toBe(expected);
  });

  it('returns a subset of the gaps in their order', () => {
    const gaps = keywordGapsOf(
      [
        gapEntry({ text: 'a', positions: { [RIVAL]: 12 }, opportunity: 80 }),
        gapEntry({ text: 'b', positions: { [RIVAL]: 3 }, opportunity: 70 }),
        gapEntry({ text: 'c', positions: { [RIVAL]: 20 }, opportunity: 60 }),
      ],
      scope(),
    );

    expect(textsOf(winnableOf(gaps))).toEqual(['a', 'c']);
  });
});

describe('leadsOf', () => {
  it('answers the margin over the best competitor', () => {
    const [row] = leadsOf(
      [gapEntry({ you: 6, positions: { [RIVAL]: 7, [OTHER]: 12 } })],
      scope(),
    );

    expect(row).toMatchObject({
      yourPosition: 6,
      bestCompetitorPosition: 7,
      gap: 1,
    });
  });

  it.each([
    ['a tie', 5, 5, false],
    ['a competitor ahead', 6, 5, false],
    ['the app unranked', null, 8, false],
  ])('is no lead on %s', (_, you, rival, expected) => {
    expect(isLeadRow(gapEntry({ you, positions: { [RIVAL]: rival } }))).toBe(
      expected,
    );
  });

  it('leads with no margin when no competitor ranks', () => {
    const [row] = leadsOf(
      [gapEntry({ you: 45, positions: { [RIVAL]: null, [OTHER]: null } })],
      scope(),
    );

    expect(row).toMatchObject({ gap: null, bestCompetitorPosition: null });
  });

  it('is no lead over a competitor nobody checked', () => {
    const entry = gapEntry({
      you: 3,
      positions: { [RIVAL]: null, [OTHER]: 9 },
      unchecked: [RIVAL],
    });

    expect(isLeadRow(entry)).toBe(false);
  });

  it('judges a lead over the competitors still listed', () => {
    const entry = gapEntry({ you: 3, positions: { [RIVAL]: 1, [OTHER]: 9 } });

    expect(isLeadRow(entry, scope([RIVAL]))).toBe(true);
    expect(isLeadRow(entry, scope([RIVAL], [RIVAL]))).toBe(false);
  });

  it('measures the margin against the best of two', () => {
    const [row] = leadsOf(
      [gapEntry({ you: 3, positions: { [RIVAL]: 4, [OTHER]: null } })],
      scope(),
    );

    expect(row?.gap).toBe(1);
  });

  it('is never both a gap and a lead', () => {
    const entries = [
      gapEntry({ text: 'a', you: null, positions: { [RIVAL]: 5 } }),
      gapEntry({ text: 'b', you: 2, positions: { [RIVAL]: 8 } }),
      gapEntry({ text: 'c', you: 150, positions: { [RIVAL]: 20 } }),
    ];
    const gaps = textsOf(keywordGapsOf(entries, scope()));
    const leads = textsOf(leadsOf(entries, scope()));

    expect(gaps.filter((text) => leads.includes(text))).toEqual([]);
  });
});

describe('order', () => {
  const ordered = (entries: GapRow[]) =>
    textsOf(keywordGapsOf(entries, scope()));
  const gapWith = (
    text: string,
    opportunity: number | null,
    volume: number | null = 10,
  ) => gapEntry({ text, opportunity, volume, positions: { [RIVAL]: 5 } });

  it('sorts by opportunity with zero ahead of none', () => {
    expect(
      ordered([
        gapWith('null', null),
        gapWith('forty', 40),
        gapWith('zero', 0),
        gapWith('fifty', 50),
      ]),
    ).toEqual(['fifty', 'forty', 'zero', 'null']);
  });

  it('breaks an opportunity tie by popularity', () => {
    expect(
      ordered([
        gapWith('ten', 20, 10),
        gapWith('none', 20, null),
        gapWith('thirty', 20, 30),
      ]),
    ).toEqual(['thirty', 'ten', 'none']);
  });

  it('breaks a full tie by text', () => {
    expect(ordered([gapWith('b', 20), gapWith('a', 20)])).toEqual(['a', 'b']);
  });
});

describe('gapCoverage', () => {
  it('counts the comparable competitors and the compared keywords per market', () => {
    const entries = [
      gapEntry({ keywordId: 'us-1', positions: { [RIVAL]: 5 } }),
      gapEntry({ keywordId: 'us-2', positions: { [RIVAL]: 8 } }),
      gapEntry({
        keywordId: 'us-3',
        positions: { [RIVAL]: null, [OTHER]: null },
        unchecked: [RIVAL, OTHER],
      }),
      gapEntry({
        keywordId: 'de-1',
        country: 'de',
        positions: { [RIVAL]: null, [OTHER]: null },
        unchecked: [RIVAL, OTHER, 'app-gone'],
      }),
    ];
    const coverage = gapCoverage(entries, {
      primaryId: PRIMARY,
      competitors: [
        { id: RIVAL, delisted: false },
        { id: OTHER, delisted: false },
        { id: 'app-gone', delisted: true },
      ],
    });

    expect(coverage).toEqual({
      competitors: 2,
      delisted: 1,
      markets: [
        { country: 'de', keywords: 1, compared: 0 },
        { country: 'us', keywords: 3, compared: 2 },
      ],
    });
  });

  it('compares nothing without a competitor', () => {
    const coverage = gapCoverage([gapEntry({ you: 3 })], scope([], []));

    expect(coverage).toEqual({
      competitors: 0,
      delisted: 0,
      markets: [{ country: 'us', keywords: 1, compared: 0 }],
    });
  });
});

describe('threatRows', () => {
  const TODAY = '2026-11-03';
  const checks = (now: number | null, before: number | null): CheckSeries => [
    { date: TODAY, position: now },
    { date: '2026-11-02', position: before },
  ];
  const recentFor = (
    keywordId: string,
    byApp: Record<string, CheckSeries>,
  ): RecentChecks => new Map([[keywordId, new Map(Object.entries(byApp))]]);
  const closingEntry = (overrides: Parameters<typeof gapEntry>[0] = {}) =>
    gapEntry({
      keywordId: 'kw-threat',
      you: 5,
      positions: { [RIVAL]: 7 },
      latestCheckedOn: TODAY,
      ...overrides,
    });
  const closingChecks = recentFor('kw-threat', {
    [PRIMARY]: checks(5, 5),
    [RIVAL]: checks(7, 9),
  });

  it('names the threatening competitor with why it threatens', () => {
    const [row] = threatRows([closingEntry()], scope(), closingChecks, TODAY);

    expect(row).toEqual(
      expect.objectContaining({
        threat: 'closing',
        competitorDelta: 2,
        overtookOn: null,
        bestCompetitorId: RIVAL,
        bestCompetitorPosition: 7,
        yourPosition: 5,
        gap: null,
        country: 'us',
        lastCheckedOn: TODAY,
      }),
    );
  });

  it('never names a delisted competitor', () => {
    expect(
      threatRows([closingEntry()], scope([RIVAL]), closingChecks, TODAY),
    ).toEqual([]);
    expect(
      threatRows([closingEntry()], scope([RIVAL, OTHER]), closingChecks, TODAY),
    ).toEqual([]);
  });

  it('leaves out a keyword the app was never checked on', () => {
    expect(
      threatRows(
        [closingEntry({ unchecked: [PRIMARY] })],
        scope(),
        closingChecks,
        TODAY,
      ),
    ).toEqual([]);
  });

  it('keeps a stale keyword in the gaps and out of the threats', () => {
    const stale = gapEntry({
      keywordId: 'kw-stale',
      you: null,
      positions: { [RIVAL]: 4 },
      latestCheckedOn: '2026-10-30',
    });
    const recent = recentFor('kw-stale', {
      [PRIMARY]: [{ date: '2026-10-30', position: 20 }],
      [RIVAL]: checks(22, 25),
    });
    const lists = competitorGapLists({
      scope: scope(),
      rows: [stale],
      recent,
      today: TODAY,
    });

    expect(lists.threats).toEqual([]);
    expect(lists.keywordGaps.map(({ keywordId }) => keywordId)).toEqual([
      'kw-stale',
    ]);
  });
});

describe('competitorGapLists', () => {
  const TODAY = '2026-11-03';

  it('assembles every list and the coverage', () => {
    const entries = [
      gapEntry({ text: 'gap', positions: { [RIVAL]: 12 }, opportunity: 30 }),
      gapEntry({ text: 'lead', you: 2, positions: { [RIVAL]: 8 } }),
      gapEntry({ text: 'threat', you: 5, positions: { [RIVAL]: 6 } }),
    ];
    const recent: RecentChecks = new Map([
      [
        'kw-threat',
        new Map([
          [
            PRIMARY,
            [
              { date: TODAY, position: 5 },
              { date: '2026-11-02', position: 5 },
            ],
          ],
          [
            RIVAL,
            [
              { date: TODAY, position: 6 },
              { date: '2026-11-02', position: 9 },
            ],
          ],
        ]),
      ],
    ]);
    const lists = competitorGapLists({
      scope: scope([], [RIVAL]),
      rows: entries,
      recent,
      today: TODAY,
    });

    expect(textsOf(lists.keywordGaps)).toEqual(['gap']);
    expect(textsOf(lists.winnable)).toEqual(['gap']);
    expect(textsOf(lists.threats)).toEqual(['threat']);
    expect(textsOf(lists.lead)).toEqual(['lead', 'threat']);
    expect(lists.coverage.competitors).toBe(1);
    expect(
      textsOf(lists.threats).filter((text) =>
        textsOf(lists.keywordGaps).includes(text),
      ),
    ).toEqual([]);
  });

  it('answers empty lists without a competitor', () => {
    const lists = competitorGapLists({
      scope: scope([], []),
      rows: [gapEntry({ you: 3 })],
      recent: new Map(),
      today: TODAY,
    });

    expect(lists).toMatchObject({
      keywordGaps: [],
      winnable: [],
      threats: [],
      lead: [],
      coverage: { competitors: 0 },
    });
  });
});

describe('threatReadScope', () => {
  it('reads only the keywords the app ranks in the top 30 and the comparable apps', () => {
    const entries = [
      gapEntry({ keywordId: 'top', you: 30, positions: { [RIVAL]: 31 } }),
      gapEntry({ keywordId: 'below', you: 31, positions: { [RIVAL]: 32 } }),
      gapEntry({ keywordId: 'absent', you: null, positions: { [RIVAL]: 2 } }),
      gapEntry({
        keywordId: 'unchecked',
        you: null,
        unchecked: [PRIMARY],
      }),
    ];

    expect(threatReadScope(entries, scope([OTHER]))).toEqual({
      appIds: [PRIMARY, RIVAL],
      keywordIds: ['top'],
    });
  });

  it('reads nothing without a comparable competitor', () => {
    expect(
      threatReadScope([gapEntry({ you: 3 })], scope([RIVAL, OTHER])),
    ).toEqual({ appIds: [PRIMARY], keywordIds: ['kw-habit tracker'] });
  });
});
