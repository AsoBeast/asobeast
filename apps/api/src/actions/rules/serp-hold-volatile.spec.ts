import {
  DailyBudget,
  SerpHoldVolatileEvidence,
  TrackedKeywordItem,
} from '@asobeast/shared';
import { SerpSnapshotDay } from '../../rankings/serp-movers';
import type {
  ActionContext,
  ActionContextApp,
  ActionRankingDay,
} from '../action-context';
import {
  detectSerpHoldVolatile,
  serpHoldVolatileDetector,
} from './serp-hold-volatile';
import {
  VOLATILITY_MIN_OBSERVED_DAYS,
  VOLATILITY_THRESHOLD,
  VOLATILITY_WINDOW_DAYS,
} from './serp-volatility';

const NOW = new Date('2026-07-30T03:00:00.000Z');
const OWN = 'own-app';

const budget: DailyBudget = {
  apps: 1,
  keywords: 10,
  categories: 0,
  reviews: 1,
  total: 12,
  capacityPerDay: 100,
  utilization: 0.12,
  stores: [],
};

const keyword = (
  overrides: Partial<TrackedKeywordItem> = {},
): TrackedKeywordItem => ({
  keywordId: 'kw_1',
  text: 'budget planner',
  country: 'us',
  source: 'MANUAL',
  active: true,
  latestPosition: 6,
  latestDepth: 200,
  previousPosition: 4,
  positionDelta1d: null,
  positionDelta7d: null,
  traffic: 5.5,
  difficulty: 4,
  volume: 55,
  relevance: 80,
  opportunity: 60,
  bucket: null,
  scoredAt: null,
  scoreProvenance: null,
  serpVolatility7d: null,
  ...overrides,
});

const day = (offset: number): string =>
  new Date(NOW.getTime() - offset * 86_400_000).toISOString().slice(0, 10);

const snapshot = (
  offset: number,
  ids: Array<[string, number]>,
): SerpSnapshotDay => ({
  date: day(offset),
  entries: ids.map(([storeAppId, position]) => ({
    storeAppId,
    position,
    title: `App ${storeAppId}`,
  })),
});

const BASELINE: Array<[string, number]> = [
  ['x1', 1],
  ['x2', 2],
  ['x3', 3],
  [OWN, 6],
];

const INVADED: Array<[string, number]> = [
  ['new1', 1],
  ['new2', 2],
  ['x1', 3],
  [OWN, 6],
];

const CHURNING: SerpSnapshotDay[] = [
  snapshot(5, BASELINE),
  snapshot(4, BASELINE),
  snapshot(3, BASELINE),
  snapshot(2, BASELINE),
  snapshot(1, INVADED),
];

const rankingDays = (positions: Array<number | null>): ActionRankingDay[] =>
  positions.map((position, index) => ({
    date: day(positions.length - index),
    position,
  }));

const app = (overrides: Partial<ActionContextApp> = {}): ActionContextApp => ({
  id: 'app_1',
  name: 'Budget',
  store: 'APP_STORE',
  storeAppId: OWN,
  country: 'us',
  trackedKeywords: [keyword()],
  keywordsByCountry: new Map(),
  coverage: [],
  metadataFields: [],
  audit: null,
  changeEvents: [],
  visibilityByCountry: new Map(),
  rankingDaysByKeyword: new Map([['kw_1', rankingDays([4, 5, 6, 6, 6])]]),
  serpDaysByKeyword: new Map([['kw_1', CHURNING]]),
  volatilityByKeyword: new Map([['kw_1', 61]]),
  competitorAppIdsByStoreAppId: new Map(),
  reviews: [],
  latestVersion: null,
  previousVersion: null,
  ...overrides,
});

const context = (apps: ActionContextApp[]): ActionContext => ({
  workspaceId: 'ws_1',
  apps,
  budget,
  reviewScoreMax: 2,
  rankDropThreshold: 5,
});

describe('serp.hold_volatile', () => {
  it('registers for its rule', () => {
    expect(serpHoldVolatileDetector.rule).toBe('serp.hold_volatile');
  });

  it('returns nothing for an empty context', () => {
    expect(detectSerpHoldVolatile(context([]), NOW)).toEqual([]);
  });

  it('fires only after it actually damped another rule, naming it', () => {
    const detections = detectSerpHoldVolatile(context([app()]), NOW);

    expect(detections).toHaveLength(1);
    const evidence = detections[0].evidence as SerpHoldVolatileEvidence;
    expect(evidence).toMatchObject({
      rule: 'serp.hold_volatile',
      volatility: 61,
      windowDays: VOLATILITY_WINDOW_DAYS,
      observedDays: 5,
      yourPosition: 6,
      dampenedRules: ['keyword.defend'],
    });
    expect(detections[0].terms).toEqual({
      reach: 0.55,
      severity: 0.61,
      confidence: 5 / VOLATILITY_WINDOW_DAYS,
    });
  });

  it('stays silent for a volatile keyword that damped nothing', () => {
    const quiet = app({
      serpDaysByKeyword: new Map([
        [
          'kw_1',
          [
            snapshot(5, BASELINE),
            snapshot(4, BASELINE),
            snapshot(3, BASELINE),
            snapshot(2, BASELINE),
            snapshot(1, BASELINE),
          ],
        ],
      ]),
    });

    expect(detectSerpHoldVolatile(context([quiet]), NOW)).toEqual([]);
  });

  it('stays silent below the volatility threshold', () => {
    const calm = app({
      volatilityByKeyword: new Map([['kw_1', VOLATILITY_THRESHOLD - 1]]),
    });

    expect(detectSerpHoldVolatile(context([calm]), NOW)).toEqual([]);
  });

  it('fires at exactly the volatility threshold', () => {
    const borderline = app({
      volatilityByKeyword: new Map([['kw_1', VOLATILITY_THRESHOLD]]),
    });

    expect(detectSerpHoldVolatile(context([borderline]), NOW)).toHaveLength(1);
  });

  it('stays silent below the minimum observed days', () => {
    const thin = app({
      serpDaysByKeyword: new Map([
        ['kw_1', CHURNING.slice(-(VOLATILITY_MIN_OBSERVED_DAYS - 1))],
      ]),
    });

    expect(detectSerpHoldVolatile(context([thin]), NOW)).toEqual([]);
  });

  it('stays silent when volatility was never measured', () => {
    const unknown = app({ volatilityByKeyword: new Map() });

    expect(detectSerpHoldVolatile(context([unknown]), NOW)).toEqual([]);
  });

  it('fires as a single per-keyword advisory with no discriminator', () => {
    const detections = detectSerpHoldVolatile(context([app()]), NOW);

    expect(detections[0].rule).toBe('serp.hold_volatile');
    expect(detections[0].discriminator).toBeNull();
  });
});
