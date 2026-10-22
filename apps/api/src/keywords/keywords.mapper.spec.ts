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
