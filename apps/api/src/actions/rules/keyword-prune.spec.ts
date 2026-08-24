import {
  DailyBudget,
  KeywordCoverageRow,
  KeywordPruneEvidence,
  TrackedKeywordItem,
} from '@asobeast/shared';
import {
  ActionContext,
  ActionContextApp,
  ActionRankingDay,
} from '../action-context';
import {
  detectKeywordPrune,
  keywordPruneDetector,
  PRUNE_KEYWORD_FLOOR,
  PRUNE_MAX_PER_APP,
  PRUNE_MAX_RANKED_RATIO,
  PRUNE_MAX_RELEVANCE,
  PRUNE_MAX_VOLUME,
  PRUNE_MIN_OBSERVED_DAYS,
  PRUNE_UTILIZATION_FLOOR,
} from './keyword-prune';

const budget = (utilization: number): DailyBudget => ({
  apps: 1,
  keywords: 60,
  categories: 0,
  reviews: 1,
  total: 62,
  capacityPerDay: 100,
  utilization,
  stores: [],
});

const keyword = (
  overrides: Partial<TrackedKeywordItem> = {},
): TrackedKeywordItem => ({
  keywordId: 'kw_1',
  text: 'obscure phrase',
  country: 'us',
  source: 'SUGGESTED',
  active: true,
  latestPosition: null,
  latestDepth: 200,
  previousPosition: null,
  positionDelta1d: null,
  positionDelta7d: null,
  traffic: 0.3,
  difficulty: 2,
  volume: 3,
  relevance: 20,
  opportunity: 12,
  bucket: null,
  scoredAt: '2026-07-29',
  scoreProvenance: null,
  serpVolatility7d: null,
  ...overrides,
});

const days = (count: number, rankedCount = 0): ActionRankingDay[] =>
  Array.from({ length: count }, (_, index) => ({
    date: `2026-07-${String(index + 1).padStart(2, '0')}`,
    position: index < rankedCount ? 12 : null,
  }));

const app = (overrides: Partial<ActionContextApp> = {}): ActionContextApp => ({
  id: 'app_1',
  name: 'Budget',
  store: 'APP_STORE',
  storeAppId: '1000',
  country: 'us',
  trackedKeywords: [keyword()],
  keywordsByCountry: new Map(),
  coverage: [],
  metadataFields: [],
  audit: null,
  changeEvents: [],
  visibilityByCountry: new Map(),
  rankingDaysByKeyword: new Map([['kw_1', days(PRUNE_MIN_OBSERVED_DAYS)]]),
  serpDaysByKeyword: new Map(),
  volatilityByKeyword: new Map(),
  competitorAppIdsByStoreAppId: new Map(),
  reviews: [],
  latestVersion: null,
  previousVersion: null,
  ...overrides,
});

const context = (
  apps: ActionContextApp[],
  utilization = 0.8,
): ActionContext => ({
  workspaceId: 'ws_1',
  apps,
  budget: budget(utilization),
  reviewScoreMax: 2,
  rankDropThreshold: 5,
});

describe('keyword.prune', () => {
  it('registers for its rule', () => {
    expect(keywordPruneDetector.rule).toBe('keyword.prune');
  });

  it('returns nothing for an empty context', () => {
    expect(detectKeywordPrune(context([]))).toEqual([]);
  });

  it('fires on a never-ranked, low-value keyword under budget pressure', () => {
    const detections = detectKeywordPrune(context([app()]));

    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({
      rule: 'keyword.prune',
      appId: 'app_1',
      keywordId: 'kw_1',
      country: 'us',
      discriminator: null,
      terms: { reach: 0.8, severity: 1, confidence: 1 },
    });
    const evidence = detections[0].evidence as KeywordPruneEvidence;
    expect(evidence).toMatchObject({
      checkedDays: PRUNE_MIN_OBSERVED_DAYS,
      rankedDays: 0,
      bestPosition: null,
      dailyRequestsSaved: 1,
      budgetUtilization: 0.8,
    });
  });

  describe('thresholds', () => {
    const fires = (
      overrides: Partial<TrackedKeywordItem>,
      history = days(PRUNE_MIN_OBSERVED_DAYS),
      utilization = 0.8,
    ): boolean =>
      detectKeywordPrune(
        context(
          [
            app({
              trackedKeywords: [keyword(overrides)],
              rankingDaysByKeyword: new Map([['kw_1', history]]),
            }),
          ],
          utilization,
        ),
      ).length > 0;

    it('needs at least the minimum observed days', () => {
      expect(fires({}, days(PRUNE_MIN_OBSERVED_DAYS))).toBe(true);
      expect(fires({}, days(PRUNE_MIN_OBSERVED_DAYS - 1))).toBe(false);
    });

    it('allows the ranked ratio at exactly the ceiling and not above', () => {
      const atCeiling = Math.floor(
        PRUNE_MIN_OBSERVED_DAYS * PRUNE_MAX_RANKED_RATIO,
      );
      expect(fires({}, days(PRUNE_MIN_OBSERVED_DAYS, atCeiling))).toBe(true);
      expect(fires({}, days(PRUNE_MIN_OBSERVED_DAYS, atCeiling + 1))).toBe(
        false,
      );
    });

    it('requires volume strictly below the ceiling', () => {
      expect(fires({ volume: PRUNE_MAX_VOLUME - 1 })).toBe(true);
      expect(fires({ volume: PRUNE_MAX_VOLUME })).toBe(false);
      expect(fires({ volume: null })).toBe(true);
    });

    it('requires relevance at or below the ceiling and known', () => {
      expect(fires({ relevance: PRUNE_MAX_RELEVANCE })).toBe(true);
      expect(fires({ relevance: PRUNE_MAX_RELEVANCE + 1 })).toBe(false);
      expect(fires({ relevance: null })).toBe(false);
    });

    it('skips an inactive keyword', () => {
      expect(fires({ active: false })).toBe(false);
    });

    it('fires at exactly the utilization floor and not below it', () => {
      expect(
        fires({}, days(PRUNE_MIN_OBSERVED_DAYS), PRUNE_UTILIZATION_FLOOR),
      ).toBe(true);
      expect(
        fires(
          {},
          days(PRUNE_MIN_OBSERVED_DAYS),
          PRUNE_UTILIZATION_FLOOR - 0.01,
        ),
      ).toBe(false);
    });
  });

  it('fires below the utilization floor once the keyword count floor is passed', () => {
    const many = Array.from({ length: PRUNE_KEYWORD_FLOOR + 1 }, (_, index) =>
      keyword({ keywordId: `kw_${index}` }),
    );
    const history = new Map(
      many.map((item) => [item.keywordId, days(PRUNE_MIN_OBSERVED_DAYS)]),
    );

    const detections = detectKeywordPrune(
      context(
        [app({ trackedKeywords: many, rankingDaysByKeyword: history })],
        0.05,
      ),
    );

    expect(detections).toHaveLength(PRUNE_MAX_PER_APP);
  });

  it('never fires below the utilization floor on a small tracking set', () => {
    const few = Array.from({ length: PRUNE_KEYWORD_FLOOR }, (_, index) =>
      keyword({ keywordId: `kw_${index}` }),
    );
    const history = new Map(
      few.map((item) => [item.keywordId, days(PRUNE_MIN_OBSERVED_DAYS)]),
    );

    expect(
      detectKeywordPrune(
        context(
          [app({ trackedKeywords: few, rankingDaysByKeyword: history })],
          0.05,
        ),
      ),
    ).toEqual([]);
  });

  it('emits at most the per-app cap, worst first', () => {
    const items = [
      keyword({ keywordId: 'kw_a' }),
      keyword({ keywordId: 'kw_b' }),
      keyword({ keywordId: 'kw_c' }),
      keyword({ keywordId: 'kw_d' }),
      keyword({ keywordId: 'kw_e' }),
      keyword({ keywordId: 'kw_f' }),
    ];
    const history = new Map([
      ['kw_a', days(PRUNE_MIN_OBSERVED_DAYS, 1)],
      ['kw_b', days(PRUNE_MIN_OBSERVED_DAYS)],
      ['kw_c', days(PRUNE_MIN_OBSERVED_DAYS)],
      ['kw_d', days(PRUNE_MIN_OBSERVED_DAYS)],
      ['kw_e', days(PRUNE_MIN_OBSERVED_DAYS)],
      ['kw_f', days(PRUNE_MIN_OBSERVED_DAYS)],
    ]);

    const detections = detectKeywordPrune(
      context([app({ trackedKeywords: items, rankingDaysByKeyword: history })]),
    );

    expect(detections).toHaveLength(PRUNE_MAX_PER_APP);
    expect(detections.map((detection) => detection.keywordId)).toEqual([
      'kw_b',
      'kw_c',
      'kw_d',
      'kw_e',
      'kw_f',
    ]);
  });

  it('yields to keyword.add_uncovered on the same keyword', () => {
    const contested = keyword({
      keywordId: 'kw_1',
      relevance: 80,
      volume: 62,
      opportunity: 66.5,
    });
    const coverage: KeywordCoverageRow = {
      keywordId: 'kw_1',
      text: 'obscure phrase',
      bucket: null,
      fields: [{ field: 'title', covered: false }],
      uncovered: true,
    };

    const detections = detectKeywordPrune(
      context([
        app({
          trackedKeywords: [contested],
          coverage: [coverage],
          metadataFields: [
            {
              field: 'title',
              value: 'Budget',
              chars: 6,
              limit: 30,
              indexed: true,
              issues: [],
            },
          ],
        }),
      ]),
    );

    expect(detections).toEqual([]);
  });

  it('records the best position a keyword ever reached', () => {
    const history = days(PRUNE_MIN_OBSERVED_DAYS, 1);
    history[0] = { date: '2026-07-01', position: 88 };

    const detections = detectKeywordPrune(
      context([app({ rankingDaysByKeyword: new Map([['kw_1', history]]) })]),
    );

    expect((detections[0].evidence as KeywordPruneEvidence).bestPosition).toBe(
      88,
    );
  });

  it('skips a keyword with no ranking history at all', () => {
    expect(
      detectKeywordPrune(context([app({ rankingDaysByKeyword: new Map() })])),
    ).toEqual([]);
  });
});
