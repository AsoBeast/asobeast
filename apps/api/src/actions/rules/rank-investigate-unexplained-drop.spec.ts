import { TrackedKeywordItem } from '@asobeast/shared';
import type {
  ActionChangeEvent,
  ActionContextApp,
  ActionRankingDay,
  ActionVisibilityPoint,
} from '../action-context';
import { scoreImpact } from '../action-impact';
import { detectRankInvestigateDrop } from './rank-investigate-drop';
import {
  detectRankInvestigateUnexplainedDrop,
  rankInvestigateUnexplainedDropDetector,
  UNEXPLAINED_WINDOW_DAYS,
} from './rank-investigate-unexplained-drop';
import {
  actionContext,
  contextApp,
  trackedKeyword,
} from './rule-context.fixture';

const NOW = new Date('2026-07-30T03:00:00.000Z');

const day = (offset: number): string =>
  new Date(NOW.getTime() - offset * 86_400_000).toISOString().slice(0, 10);

const series = (recent: number, baseline = 40): ActionVisibilityPoint[] =>
  Array.from({ length: 21 }, (_, index) => {
    const offset = 20 - index;
    return {
      date: day(offset),
      visibility: offset >= 8 ? baseline : offset >= 3 ? 36 : recent,
    };
  });

const keywords = (country: string, count: number): TrackedKeywordItem[] =>
  Array.from({ length: count }, (_, index) =>
    trackedKeyword({
      keywordId: `kw_${country}_${index + 1}`,
      text: `phrase ${index + 1}`,
      country,
    }),
  );

const ranking = (from: number, to: number | null): ActionRankingDay[] => [
  { date: day(9), position: from },
  { date: day(7), position: from },
  { date: day(0), position: to },
];

interface Market {
  country: string;
  count?: number;
  recent?: number;
  fallen?: number;
}

const app = (
  markets: Market[],
  overrides: Partial<ActionContextApp> = {},
  volatility = 10,
): ActionContextApp => {
  const tracked = markets.flatMap(({ country, count = 5 }) =>
    keywords(country, count),
  );
  const fallenIds = new Set(
    markets.flatMap(({ country, count = 5, fallen = 0 }) =>
      keywords(country, count)
        .slice(0, fallen)
        .map((keyword) => keyword.keywordId),
    ),
  );
  return contextApp({
    trackedKeywords: tracked,
    keywordsByCountry: new Map(
      markets.map(({ country, count = 5 }) => [
        country,
        keywords(country, count),
      ]),
    ),
    visibilityByCountry: new Map(
      markets.map(({ country, recent = 32.5 }) => [country, series(recent)]),
    ),
    rankingDaysByKeyword: new Map(
      tracked.map((keyword) => [
        keyword.keywordId,
        fallenIds.has(keyword.keywordId) ? ranking(10, 20) : ranking(10, 12),
      ]),
    ),
    volatilityByKeyword: new Map(
      tracked.map((keyword) => [keyword.keywordId, volatility]),
    ),
    ...overrides,
  });
};

const titleChange = (offset: number): ActionChangeEvent => ({
  field: 'title',
  capturedAt: new Date(`${day(offset)}T03:00:00.000Z`),
});

const detect = (apps: ActionContextApp[]) =>
  detectRankInvestigateUnexplainedDrop(actionContext(apps), NOW);

describe('rank.investigate_unexplained_drop', () => {
  it('fires on a home drop that followed no change of yours', () => {
    const context = actionContext([app([{ country: 'us' }])]);
    const [detection] = detectRankInvestigateUnexplainedDrop(context, NOW);

    expect(detection).toEqual({
      rule: 'rank.investigate_unexplained_drop',
      appId: 'app_1',
      store: 'APP_STORE',
      country: 'us',
      keywordId: null,
      discriminator: null,
      terms: { reach: 1, severity: 0.375, confidence: 0.9 },
      evidence: {
        rule: 'rank.investigate_unexplained_drop',
        country: 'us',
        visibilityBefore: 40,
        visibilityAfter: 32.5,
        visibilityDelta: 7.5,
        windowDays: 14,
        trackedKeywords: 5,
        droppedKeywords: [],
        meanVolatility: 10,
        lastOwnChangeAt: null,
      },
    });
    expect(scoreImpact(detection.rule, detection.terms)).toEqual({
      impact: 76,
      priority: 'high',
    });
    expect(detectRankInvestigateDrop(context, NOW)).toEqual([]);
    expect(rankInvestigateUnexplainedDropDetector.rule).toBe(
      'rank.investigate_unexplained_drop',
    );
  });

  it('fires on three fallen keywords with a smaller visibility drop', () => {
    const [detection] = detect([
      app([{ country: 'us', recent: 37, fallen: 3 }]),
    ]);

    expect(detection.evidence).toMatchObject({
      visibilityDelta: 3,
      droppedKeywords: [
        { keywordId: 'kw_us_1', from: 10, to: 20 },
        { keywordId: 'kw_us_2', from: 10, to: 20 },
        { keywordId: 'kw_us_3', from: 10, to: 20 },
      ],
    });
  });

  it('counts a keyword that fell out of the results as dropped', () => {
    const base = app([{ country: 'us', recent: 37, fallen: 2 }]);
    base.rankingDaysByKeyword.set('kw_us_5', ranking(10, null));

    const [detection] = detect([base]);

    expect(detection.evidence).toMatchObject({
      droppedKeywords: [
        { keywordId: 'kw_us_1', from: 10, to: 20 },
        { keywordId: 'kw_us_2', from: 10, to: 20 },
        { keywordId: 'kw_us_5', text: 'phrase 5', from: 10, to: null },
      ],
    });
  });

  it('stays silent below the drop and the fallen keyword thresholds', () => {
    expect(detect([app([{ country: 'us', recent: 35.1, fallen: 2 }])])).toEqual(
      [],
    );
  });

  it('stays silent when visibility rose while keywords fell', () => {
    expect(detect([app([{ country: 'us', recent: 42, fallen: 3 }])])).toEqual(
      [],
    );
  });

  it('withholds a drop that your own title change explains', () => {
    const context = actionContext([
      app([{ country: 'us' }], { changeEvents: [titleChange(10)] }),
    ]);

    const [detection] = detectRankInvestigateUnexplainedDrop(context, NOW);
    const explained = detectRankInvestigateDrop(context, NOW);

    expect(detection).toMatchObject({
      withheld: true,
      evidence: { lastOwnChangeAt: day(10) },
    });
    expect(explained).toHaveLength(1);
    expect(explained[0]).toMatchObject({ appId: 'app_1', country: 'us' });
  });

  it('keeps firing when your last change is older than the window', () => {
    const [detection] = detect([
      app([{ country: 'us' }], { changeEvents: [titleChange(20)] }),
    ]);

    expect(detection.withheld).toBeUndefined();
    expect(detection.evidence).toMatchObject({ lastOwnChangeAt: day(20) });
  });

  it('treats a change on the cutoff day as outside the window', () => {
    const [onCutoff] = detect([
      app([{ country: 'us' }], {
        changeEvents: [titleChange(UNEXPLAINED_WINDOW_DAYS)],
      }),
    ]);
    const [inside] = detect([
      app([{ country: 'us' }], {
        changeEvents: [titleChange(UNEXPLAINED_WINDOW_DAYS - 1)],
      }),
    ]);

    expect(onCutoff.withheld).toBeUndefined();
    expect(inside.withheld).toBe(true);
  });

  it('scores confidence against the days the window holds', () => {
    const base = app([{ country: 'us' }]);
    base.visibilityByCountry.set(
      'us',
      series(32.5).filter((point) => point.date !== day(5)),
    );
    const [detection] = detect([base]);

    expect(detection.terms.confidence).toBeCloseTo(
      ((UNEXPLAINED_WINDOW_DAYS - 1) / UNEXPLAINED_WINDOW_DAYS) * 0.9,
      10,
    );
  });

  it('stays silent once visibility recovered within the tolerance', () => {
    expect(detect([app([{ country: 'us', recent: 38.5, fallen: 3 }])])).toEqual(
      [],
    );
  });

  it('stays silent in a market with four keywords', () => {
    expect(detect([app([{ country: 'us', count: 4 }])])).toEqual([]);
  });

  it('stays silent without three baseline points', () => {
    const base = app([{ country: 'us' }]);
    base.visibilityByCountry.set(
      'us',
      series(32.5).filter((point) => point.date > day(10)),
    );

    expect(detect([base])).toEqual([]);
  });

  it('fires in another market whatever changed at home', () => {
    const detections = detect([
      app(
        [
          { country: 'us', recent: 40 },
          { country: 'de', count: 5 },
        ],
        { changeEvents: [titleChange(10)] },
      ),
    ]);

    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({
      country: 'de',
      terms: { reach: 0.5 },
      evidence: { country: 'de', lastOwnChangeAt: null },
    });
    expect(detections[0].withheld).toBeUndefined();
  });

  it('caps confidence on a volatile series without damping another rule', () => {
    const [detection] = detect([app([{ country: 'us' }], {}, 50)]);

    expect(detection.terms.confidence).toBe(0.3);
    expect(detection.dampenedBy).toBeUndefined();
  });
});
