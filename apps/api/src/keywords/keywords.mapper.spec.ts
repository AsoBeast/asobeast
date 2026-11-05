import {
  heldFacts,
  toTrackedKeywordItem,
  TrackedKeywordRow,
} from './keywords.mapper';
import type { RetainedPositionFacts } from './keyword-position-facts';

const row = (
  overrides: Partial<TrackedKeywordRow> = {},
): TrackedKeywordRow => ({
  keywordId: 'k1',
  source: 'COMPETITOR',
  active: true,
  relevance: null,
  tags: [],
  note: null,
  keywordClass: null,
  createdAt: new Date('2026-10-20T08:30:00.000Z'),
  keyword: {
    text: 'habit tracker',
    country: 'us',
    store: 'APP_STORE',
    rankings: [],
    metrics: [
      {
        traffic: 8,
        difficulty: 4,
        date: new Date('2026-07-01'),
        scoringSource: 'APPLE_SUGGEST_SEARCH',
        formulaVersion: 'app-store-v1',
        confidence: 'HIGH',
        capturedAt: new Date('2026-07-01T09:30:00.000Z'),
        stats: null,
      },
    ],
  },
  ...overrides,
});

const facts = (snapshotText: string) => ({ snapshotText });

describe('toTrackedKeywordItem', () => {
  it('carries the owner tags and note', () => {
    const item = toTrackedKeywordItem(
      row({ tags: ['core', 'brand'], note: 'Push in May' }),
    );
    expect(item.tags).toEqual(['core', 'brand']);
    expect(item.note).toBe('Push in May');
  });

  it('carries the instant the app started tracking the keyword', () => {
    expect(toTrackedKeywordItem(row()).trackedAt).toBe(
      '2026-10-20T08:30:00.000Z',
    );
  });

  it('derives volume, difficulty and a default relevance', () => {
    const item = toTrackedKeywordItem(row(), facts('daily habit tracker'));
    expect(item.volume).toBeCloseTo(80, 2);
    expect(item.relevance).toBe(60);
    expect(item.opportunity).toBe(60);
    expect(item.latestDepth).toBeNull();
  });

  it('judges a market keyword against the text of its own market', () => {
    const item = toTrackedKeywordItem(
      row({
        source: 'MANUAL',
        keyword: {
          ...row().keyword,
          text: 'gewohnheits tracker',
          country: 'de',
        },
      }),
      {
        snapshotText: 'daily habit tracker',
        marketTexts: new Map([['de', 'gewohnheits tracker taegliche serie']]),
      },
    );

    expect(item.relevance).toBe(90);
  });

  it('falls back to the home text for a market without a listing', () => {
    const item = toTrackedKeywordItem(
      row({
        source: 'MANUAL',
        keyword: {
          ...row().keyword,
          text: 'gewohnheits tracker',
          country: 'de',
        },
      }),
      { snapshotText: 'daily habit tracker', marketTexts: new Map() },
    );

    expect(item.relevance).toBe(80);
  });

  it('reports a keyword field member as the keyword field whatever else tracks it', () => {
    const member = toTrackedKeywordItem(row({ source: 'MANUAL' }), {
      ...facts('daily habit tracker'),
      inKeywordField: () => true,
    });
    const field = toTrackedKeywordItem(
      row({ source: 'KEYWORD_FIELD' }),
      facts('daily habit tracker'),
    );

    expect(member.source).toBe('KEYWORD_FIELD');
    expect(member.relevance).toBe(field.relevance);
    expect(toTrackedKeywordItem(row({ source: 'MANUAL' })).source).toBe(
      'MANUAL',
    );
  });

  describe('ranking evidence', () => {
    const ranked = (position: number | null, relevance: number | null = null) =>
      row({
        relevance,
        keyword: {
          ...row().keyword,
          text: 'geo quiz',
          rankings: [{ position, date: new Date('2026-07-01'), depth: 200 }],
        },
      });

    it('lifts a keyword the app already ranks for in the top fifty', () => {
      expect(
        toTrackedKeywordItem(ranked(3), facts('weather radar')).relevance,
      ).toBe(70);
    });

    it('lowers a competitor keyword checked and not found', () => {
      expect(
        toTrackedKeywordItem(ranked(null), facts('weather radar')).relevance,
      ).toBe(30);
    });

    it('keeps a manual relevance over ranking evidence', () => {
      expect(
        toTrackedKeywordItem(ranked(3, 55), facts('weather radar')).relevance,
      ).toBe(55);
    });
  });

  describe('score signals and the outdated flag', () => {
    const signals = {
      suggestReach: 'hit',
      suggestPrefixLength: 2,
      suggestPosition: 8,
      serpRelevance: 0.8,
      medianRatingCount: 45_000,
      flags: ['padded'],
      officialPopularity: null,
      estimatedTraffic: 6.2,
      entryDifficulty: null,
    };
    const rowWith = (
      metric: Partial<TrackedKeywordRow['keyword']['metrics'][number]>,
      store: TrackedKeywordRow['keyword']['store'] = 'APP_STORE',
    ) =>
      row({
        keyword: {
          ...row().keyword,
          store,
          metrics: [{ ...row().keyword.metrics[0], ...metric }],
        },
      });

    it('exposes the stored signals of a current row', () => {
      const item = toTrackedKeywordItem(
        rowWith({ formulaVersion: 'app-store-v5', stats: { signals } }),
      );
      expect(item.scoreSignals).toEqual(signals);
      expect(item.scoreOutdated).toBe(false);
    });

    it('passes a floor answer through', () => {
      const floor = {
        ...signals,
        officialPopularity: 41,
        officialPopularityState: 'floor',
        officialPopularityFloor: 41,
        officialPopularityWeek: '2026-10-18',
        officialPopularityLastAboveFloor: { value: 63, week: '2026-09-06' },
      };
      const item = toTrackedKeywordItem(
        rowWith({ formulaVersion: 'app-store-v5', stats: { signals: floor } }),
      );
      expect(item.scoreSignals).toEqual(floor);
    });

    it('adds no floor answer to a row scored before it existed', () => {
      const item = toTrackedKeywordItem(
        rowWith({ formulaVersion: 'app-store-v5', stats: { signals } }),
      );
      expect(item.scoreSignals).not.toHaveProperty('officialPopularityState');
      expect(item.scoreSignals).toEqual(signals);
    });

    it('keeps the signals of a row with a malformed floor field', () => {
      const item = toTrackedKeywordItem(
        rowWith({
          formulaVersion: 'app-store-v5',
          stats: { signals: { ...signals, officialPopularityFloor: '41' } },
        }),
      );
      expect(item.scoreSignals).toEqual(signals);
    });

    it('marks a row scored by an older formula', () => {
      const item = toTrackedKeywordItem(
        rowWith({ formulaVersion: 'app-store-v1', stats: {} }),
      );
      expect(item.scoreSignals).toBeNull();
      expect(item.scoreOutdated).toBe(true);
    });

    it('compares against the current version of the row store', () => {
      const item = toTrackedKeywordItem(
        rowWith({ formulaVersion: 'app-store-v5' }, 'GOOGLE_PLAY'),
      );
      expect(item.scoreOutdated).toBe(true);
    });

    it('says nothing about a keyword that was never scored', () => {
      const item = toTrackedKeywordItem(
        row({ keyword: { ...row().keyword, metrics: [] } }),
      );
      expect(item.scoreSignals).toBeUndefined();
      expect(item.scoreOutdated).toBeUndefined();
      expect(item).not.toHaveProperty('scoreOutdated');
    });
  });

  it('lets a manual relevance override beat the default', () => {
    const item = toTrackedKeywordItem(
      row({ relevance: 95 }),
      facts('daily habit tracker'),
    );
    expect(item.relevance).toBe(95);
  });

  it('returns a null opportunity for unscored keywords', () => {
    const item = toTrackedKeywordItem(
      row({
        keyword: {
          text: 'habit tracker',
          country: 'us',
          store: 'APP_STORE',
          rankings: [],
          metrics: [],
        },
      }),
      facts(''),
    );
    expect(item.volume).toBeNull();
    expect(item.opportunity).toBeNull();
    expect(item.scoreProvenance).toBeNull();
  });

  it('maps complete score provenance', () => {
    expect(toTrackedKeywordItem(row()).scoreProvenance).toEqual({
      source: 'APPLE_SUGGEST_SEARCH',
      formulaVersion: 'app-store-v1',
      capturedAt: '2026-07-01T09:30:00.000Z',
      confidence: 'HIGH',
    });
  });

  it('maps partial and unknown provenance to null', () => {
    const base = row().keyword.metrics[0];
    expect(
      toTrackedKeywordItem(
        row({
          keyword: {
            ...row().keyword,
            metrics: [{ ...base, formulaVersion: null }],
          },
        }),
      ).scoreProvenance,
    ).toBeNull();
    expect(
      toTrackedKeywordItem(
        row({
          keyword: {
            ...row().keyword,
            metrics: [{ ...base, confidence: 'UNKNOWN' }],
          },
        }),
      ).scoreProvenance,
    ).toBeNull();
  });

  const withRankings = (
    rankings: { position: number | null; date: string; depth?: number }[],
  ): TrackedKeywordRow =>
    row({
      keyword: {
        text: 'habit tracker',
        country: 'us',
        store: 'APP_STORE',
        rankings: rankings.map((ranking) => ({
          position: ranking.position,
          date: new Date(ranking.date),
          depth: ranking.depth ?? 100,
        })),
        metrics: [],
      },
    });

  it('reports the day of the newest check', () => {
    const item = toTrackedKeywordItem(
      withRankings([
        { position: null, date: '2026-07-02', depth: 200 },
        { position: 4, date: '2026-07-01' },
      ]),
    );
    expect(item.latestCheckedOn).toBe('2026-07-02');
  });

  it('reports no check day for a keyword never checked', () => {
    expect(toTrackedKeywordItem(withRankings([])).latestCheckedOn).toBeNull();
  });

  it('carries the latest captured depth through the response', () => {
    const item = toTrackedKeywordItem(
      withRankings([{ position: null, date: '2026-07-02', depth: 200 }]),
    );
    expect(item.latestPosition).toBeNull();
    expect(item.latestDepth).toBe(200);
  });

  it('reports an improvement as a negative daily delta', () => {
    const item = toTrackedKeywordItem(
      withRankings([
        { position: 3, date: '2026-07-02' },
        { position: 4, date: '2026-07-01' },
      ]),
    );
    expect(item.previousPosition).toBe(4);
    expect(item.positionDelta1d).toBe(-1);
  });

  it('reports a drop as a positive daily delta', () => {
    const item = toTrackedKeywordItem(
      withRankings([
        { position: 5, date: '2026-07-02' },
        { position: 3, date: '2026-07-01' },
      ]),
    );
    expect(item.previousPosition).toBe(3);
    expect(item.positionDelta1d).toBe(2);
  });

  it('reports a zero daily delta when unchanged', () => {
    const item = toTrackedKeywordItem(
      withRankings([
        { position: 3, date: '2026-07-02' },
        { position: 3, date: '2026-07-01' },
      ]),
    );
    expect(item.positionDelta1d).toBe(0);
  });

  it('yields a null delta when there is no row for yesterday', () => {
    const item = toTrackedKeywordItem(
      withRankings([
        { position: 3, date: '2026-07-02' },
        { position: 4, date: '2026-06-30' },
      ]),
    );
    expect(item.previousPosition).toBeNull();
    expect(item.positionDelta1d).toBeNull();
  });

  it('yields a null delta when yesterday had no position', () => {
    const item = toTrackedKeywordItem(
      withRankings([
        { position: 3, date: '2026-07-02' },
        { position: null, date: '2026-07-01' },
      ]),
    );
    expect(item.previousPosition).toBeNull();
    expect(item.positionDelta1d).toBeNull();
  });

  it('yields a null delta when today has no position', () => {
    const item = toTrackedKeywordItem(
      withRankings([
        { position: null, date: '2026-07-02' },
        { position: 4, date: '2026-07-01' },
      ]),
    );
    expect(item.previousPosition).toBe(4);
    expect(item.positionDelta1d).toBeNull();
  });

  describe('last ranked position', () => {
    const lastRanked = (row: TrackedKeywordRow) => {
      const item = toTrackedKeywordItem(row);
      return {
        lastRankedPosition: item.lastRankedPosition,
        lastRankedOn: item.lastRankedOn,
      };
    };

    it.each([
      {
        situation: 'lost yesterday',
        rankings: [
          { position: null, date: '2026-07-02' },
          { position: 14, date: '2026-07-01' },
        ],
        expected: { lastRankedPosition: 14, lastRankedOn: '2026-07-01' },
        previous: { previousPosition: 14, positionDelta1d: null },
      },
      {
        situation: 'lost for three checks',
        rankings: [
          { position: null, date: '2026-07-04' },
          { position: null, date: '2026-07-03' },
          { position: null, date: '2026-07-02' },
          { position: 9, date: '2026-06-29' },
        ],
        expected: { lastRankedPosition: 9, lastRankedOn: '2026-06-29' },
        previous: { previousPosition: null, positionDelta1d: null },
      },
      {
        situation: 'skips the unranked checks between',
        rankings: [
          { position: null, date: '2026-07-04' },
          { position: null, date: '2026-07-03' },
          { position: 9, date: '2026-07-02' },
        ],
        expected: { lastRankedPosition: 9, lastRankedOn: '2026-07-02' },
        previous: { previousPosition: null, positionDelta1d: null },
      },
      {
        situation: 'picks the newest ranked check, not the best or the oldest',
        rankings: [
          { position: null, date: '2026-07-04' },
          { position: 9, date: '2026-07-02' },
          { position: 3, date: '2026-07-01' },
          { position: 20, date: '2026-06-30' },
        ],
        expected: { lastRankedPosition: 9, lastRankedOn: '2026-07-02' },
        previous: { previousPosition: null, positionDelta1d: null },
      },
      {
        situation: 'ranked today',
        rankings: [
          { position: 4, date: '2026-07-02' },
          { position: 6, date: '2026-07-01' },
        ],
        expected: { lastRankedPosition: null, lastRankedOn: null },
        previous: { previousPosition: 6, positionDelta1d: -2 },
      },
      {
        situation: 'never ranked in the window',
        rankings: [
          { position: null, date: '2026-07-02' },
          { position: null, date: '2026-07-01' },
        ],
        expected: { lastRankedPosition: null, lastRankedOn: null },
        previous: { previousPosition: null, positionDelta1d: null },
      },
      {
        situation: 'never checked',
        rankings: [],
        expected: { lastRankedPosition: null, lastRankedOn: null },
        previous: { previousPosition: null, positionDelta1d: null },
      },
      {
        situation: 'a gap in the checks',
        rankings: [
          { position: null, date: '2026-07-10' },
          { position: 11, date: '2026-07-01' },
        ],
        expected: { lastRankedPosition: 11, lastRankedOn: '2026-07-01' },
        previous: { previousPosition: null, positionDelta1d: null },
      },
      {
        situation: 'the first check found nothing',
        rankings: [{ position: null, date: '2026-07-02' }],
        expected: { lastRankedPosition: null, lastRankedOn: null },
        previous: { previousPosition: null, positionDelta1d: null },
      },
    ])('$situation', ({ rankings, expected, previous }) => {
      const active = withRankings(rankings);
      const item = toTrackedKeywordItem(active);

      expect(lastRanked(active)).toEqual(expected);
      expect({
        previousPosition: item.previousPosition,
        positionDelta1d: item.positionDelta1d,
      }).toEqual(previous);
      expect(lastRanked({ ...active, active: false })).toEqual(expected);
    });
  });

  const holdDay = (offset: number): string => {
    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - offset);
    return date.toISOString();
  };

  const hold = (
    facts: Partial<RetainedPositionFacts> = {},
  ): RetainedPositionFacts => ({
    bestPosition: null,
    daysInTier: null,
    latestPosition: 1,
    latestDate: holdDay(0),
    ...facts,
  });

  const heldRankings = (
    rankings: { position: number | null; offset: number }[],
  ): TrackedKeywordRow =>
    withRankings(
      rankings.map((ranking) => ({
        position: ranking.position,
        date: holdDay(ranking.offset),
      })),
    );

  it('reports the best position and the gap to it', () => {
    const item = toTrackedKeywordItem(
      withRankings([
        { position: 5, date: '2026-07-04' },
        { position: 5, date: '2026-07-03' },
      ]),
      undefined,
      null,
      hold({ bestPosition: 2 }),
    );
    expect(item.bestPosition).toBe(2);
    expect(item.positionDeltaFromBest).toBe(3);
  });

  it('reports zero off best at the historical best', () => {
    const item = toTrackedKeywordItem(
      withRankings([{ position: 2, date: '2026-07-04' }]),
      undefined,
      null,
      hold({ bestPosition: 2 }),
    );
    expect(item.positionDeltaFromBest).toBe(0);
  });

  it('never reports a gap below best when a same day check improved on the aggregate', () => {
    const item = toTrackedKeywordItem(
      withRankings([{ position: 1, date: '2026-07-04' }]),
      undefined,
      null,
      hold({ bestPosition: 5, daysInTier: 1 }),
    );
    expect(item.bestPosition).toBe(1);
    expect(item.positionDeltaFromBest).toBe(0);
  });

  it('leaves the hold facts out when the list did not ask for them', () => {
    const item = toTrackedKeywordItem(
      withRankings([{ position: 1, date: '2026-07-04' }]),
    );
    expect(item).not.toHaveProperty('bestPosition');
    expect(item).not.toHaveProperty('positionDeltaFromBest');
    expect(item).not.toHaveProperty('daysInTier');
    expect(item).not.toHaveProperty('heldTier');
  });

  it('yields null hold facts when the facts were computed but none recorded', () => {
    const item = toTrackedKeywordItem(
      withRankings([{ position: null, date: '2026-07-04' }]),
      undefined,
      null,
      null,
    );
    expect(item.bestPosition).toBeNull();
    expect(item.positionDeltaFromBest).toBeNull();
    expect(item.daysInTier).toBeNull();
    expect(item.heldTier).toBeNull();
  });

  it('counts the days held in the tier of the latest position and names the tier', () => {
    const item = toTrackedKeywordItem(
      heldRankings([
        { position: 1, offset: 3 },
        { position: 1, offset: 2 },
        { position: 1, offset: 1 },
        { position: 2, offset: 0 },
      ]),
      undefined,
      null,
      hold({ bestPosition: 1, daysInTier: 3 }),
    );
    expect(item.daysInTier).toBe(3);
    expect(item.heldTier).toBe(1);
    expect(item.bestPosition).toBe(1);
    expect(item.positionDeltaFromBest).toBe(0);
  });

  it('names the wider tier when the keyword sits below its peak tier', () => {
    const item = toTrackedKeywordItem(
      heldRankings([
        { position: 2, offset: 0 },
        { position: 1, offset: 1 },
      ]),
      undefined,
      null,
      hold({ bestPosition: 1, daysInTier: 2, latestPosition: 2 }),
    );
    expect(item.daysInTier).toBe(2);
    expect(item.heldTier).toBe(3);
  });

  it('yields the streak only while the keyword is checked through yesterday', () => {
    const item = toTrackedKeywordItem(
      heldRankings([
        { position: 1, offset: 3 },
        { position: 1, offset: 2 },
        { position: 1, offset: 0 },
      ]),
      undefined,
      null,
      hold({ bestPosition: 1, daysInTier: 3, latestDate: holdDay(3) }),
    );
    expect(item.daysInTier).toBeNull();
    expect(item.heldTier).toBeNull();
    expect(item.bestPosition).toBe(1);
  });

  it('yields no streak for a paused keyword', () => {
    const item = toTrackedKeywordItem(
      {
        ...heldRankings([
          { position: 1, offset: 1 },
          { position: 1, offset: 0 },
        ]),
        active: false,
      },
      undefined,
      null,
      hold({ bestPosition: 1, daysInTier: 2 }),
    );
    expect(item.daysInTier).toBeNull();
    expect(item.heldTier).toBeNull();
  });
});

describe('uncovered', () => {
  const judged = (verdict: boolean) => ({
    snapshotText: '',
    uncovered: jest.fn().mockReturnValue(verdict),
  });

  it('answers the coverage verdict of an active keyword', () => {
    const app = judged(true);

    const item = toTrackedKeywordItem(row(), app);

    expect(item.uncovered).toBe(true);
    expect(app.uncovered).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'habit tracker', country: 'us' }),
    );
  });

  it('leaves the verdict off a paused keyword', () => {
    const item = toTrackedKeywordItem(row({ active: false }), judged(true));

    expect(item).not.toHaveProperty('uncovered');
  });

  it('leaves the verdict off when the list did not ask for coverage', () => {
    const item = toTrackedKeywordItem(row(), facts(''));

    expect(item).not.toHaveProperty('uncovered');
  });
});

describe('dropStreak', () => {
  const day = (offset: number): string => {
    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - offset);
    return date.toISOString();
  };

  const listed = (
    positions: (number | null)[],
    newestOffset = 0,
    active = true,
  ): TrackedKeywordRow => {
    const base = row();
    return {
      ...base,
      active,
      keyword: {
        ...base.keyword,
        rankings: positions.map((position, index) => ({
          position,
          date: new Date(day(newestOffset + index)),
          depth: 200,
        })),
      },
    };
  };

  const noHold = null;

  it('counts the checks in a row at which the position got worse', () => {
    const item = toTrackedKeywordItem(
      listed([9, 7, 5, 3]),
      undefined,
      null,
      noHold,
    );
    expect(item.dropStreak).toBe(3);
  });

  it('answers zero when the newest check did not fall', () => {
    const item = toTrackedKeywordItem(listed([5, 5]), undefined, null, noHold);
    expect(item.dropStreak).toBe(0);
  });

  it('still answers the streak when the newest check is from yesterday', () => {
    const item = toTrackedKeywordItem(
      listed([9, 7, 5], 1),
      undefined,
      null,
      noHold,
    );
    expect(item.dropStreak).toBe(2);
  });

  it.each<[string, TrackedKeywordRow]>([
    ['a paused keyword', listed([9, 7, 5, 3], 0, false)],
    ['a keyword never checked', listed([])],
    ['a keyword whose newest check is two days old', listed([9, 7, 5, 3], 2)],
  ])('answers null for %s', (_case, tracked) => {
    const item = toTrackedKeywordItem(tracked, undefined, null, noHold);
    expect(item.dropStreak).toBeNull();
  });

  it('leaves the streak out when the list did not ask for the position facts', () => {
    const item = toTrackedKeywordItem(listed([9, 7, 5, 3]));
    expect(item).not.toHaveProperty('dropStreak');
  });
});

describe('heldFacts', () => {
  const today = new Date('2026-10-18T12:00:00.000Z');
  const facts = (latestDate: string): RetainedPositionFacts => ({
    bestPosition: 2,
    daysInTier: 5,
    latestPosition: 2,
    latestDate,
  });

  it('keeps the streak when the newest check is from today', () => {
    const held = heldFacts(facts('2026-10-18'), 2, true, today);
    expect(held.daysInTier).toBe(5);
    expect(held.heldTier).toBe(3);
  });

  it('keeps the streak through yesterday', () => {
    const held = heldFacts(facts('2026-10-17'), 2, true, today);
    expect(held.daysInTier).toBe(5);
    expect(held.heldTier).toBe(3);
  });

  it('drops the streak when the newest check is two days old', () => {
    const held = heldFacts(facts('2026-10-16'), 2, true, today);
    expect(held.daysInTier).toBeNull();
    expect(held.heldTier).toBeNull();
    expect(held.bestPosition).toBe(2);
    expect(held.positionDeltaFromBest).toBe(0);
  });

  it('drops the streak for a paused keyword', () => {
    const held = heldFacts(facts('2026-10-18'), 2, false, today);
    expect(held.daysInTier).toBeNull();
    expect(held.heldTier).toBeNull();
  });
});

describe('keyword class', () => {
  const signals = {
    suggestReach: 'hit',
    suggestPrefixLength: 2,
    suggestPosition: 8,
    serpRelevance: 0.3,
    medianRatingCount: 45_000,
    flags: ['brand'],
    officialPopularity: null,
    estimatedTraffic: 6.2,
    entryDifficulty: null,
  };
  const scored = (keywordClass: string | null = null) =>
    row({
      keywordClass,
      keyword: {
        ...row().keyword,
        metrics: [{ ...row().keyword.metrics[0], stats: { signals } }],
      },
    });

  it('answers neither field when the list did not ask for the class', () => {
    const item = toTrackedKeywordItem(scored(), facts(''));
    expect(item).not.toHaveProperty('keywordClass');
    expect(item).not.toHaveProperty('keywordClassSource');
  });

  it('answers the detected class from the text, the market and the stored signals', () => {
    const classOf = jest.fn().mockReturnValue('competitorBrand');
    const item = toTrackedKeywordItem(scored(), { ...facts(''), classOf });
    expect(item.keywordClass).toBe('competitorBrand');
    expect(item.keywordClassSource).toBe('detected');
    expect(classOf).toHaveBeenCalledWith({
      text: 'habit tracker',
      country: 'us',
      flags: ['brand'],
      serpRelevance: 0.3,
    });
  });

  it('hands an unscored keyword no flags and no relevance', () => {
    const classOf = jest.fn().mockReturnValue('generic');
    toTrackedKeywordItem(row({ keyword: { ...row().keyword, metrics: [] } }), {
      ...facts(''),
      classOf,
    });
    expect(classOf).toHaveBeenCalledWith({
      text: 'habit tracker',
      country: 'us',
      flags: [],
      serpRelevance: null,
    });
  });

  it("answers the owner's stored class without detecting one", () => {
    const classOf = jest.fn().mockReturnValue('generic');
    const item = toTrackedKeywordItem(scored('ownBrand'), {
      ...facts(''),
      classOf,
    });
    expect(item.keywordClass).toBe('ownBrand');
    expect(item.keywordClassSource).toBe('owner');
    expect(classOf).not.toHaveBeenCalled();
  });

  it('ignores a stored value it does not know', () => {
    const classOf = jest.fn().mockReturnValue('generic');
    const item = toTrackedKeywordItem(scored('brand'), {
      ...facts(''),
      classOf,
    });
    expect(item.keywordClass).toBe('generic');
    expect(item.keywordClassSource).toBe('detected');
  });
});
