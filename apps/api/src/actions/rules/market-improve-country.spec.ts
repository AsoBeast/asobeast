import {
  DailyBudget,
  MarketImproveCountryEvidence,
  TrackedKeywordItem,
} from '@asobeast/shared';
import type {
  ActionContext,
  ActionContextApp,
  ActionVisibilityPoint,
} from '../action-context';
import {
  detectMarketImproveCountry,
  MARKET_MIN_GAP,
  MARKET_MIN_KEYWORDS,
  MARKET_MIN_OBSERVED_DAYS,
  MARKET_WINDOW_DAYS,
  marketImproveCountryDetector,
} from './market-improve-country';

const NOW = new Date('2026-07-30T03:00:00.000Z');

const budget: DailyBudget = {
  apps: 1,
  keywords: 20,
  categories: 0,
  reviews: 1,
  total: 22,
  capacityPerDay: 100,
  utilization: 0.22,
  stores: [],
};

const day = (offset: number): string =>
  new Date(NOW.getTime() - offset * 86_400_000).toISOString().slice(0, 10);

const keyword = (
  keywordId: string,
  country: string,
  overrides: Partial<TrackedKeywordItem> = {},
): TrackedKeywordItem => ({
  keywordId,
  text: `phrase ${keywordId}`,
  country,
  source: 'MANUAL',
  active: true,
  latestPosition: 12,
  latestDepth: 200,
  previousPosition: 12,
  positionDelta1d: null,
  positionDelta7d: null,
  traffic: 5,
  difficulty: 4,
  volume: 50,
  relevance: 70,
  opportunity: 55,
  bucket: null,
  scoredAt: null,
  scoreProvenance: null,
  serpVolatility7d: null,
  ...overrides,
});

const marketKeywords = (
  country: string,
  count: number,
  overrides: Partial<TrackedKeywordItem> = {},
): TrackedKeywordItem[] =>
  Array.from({ length: count }, (_, index) =>
    keyword(`${country}_${index}`, country, overrides),
  );

const series = (
  value: number,
  days = MARKET_MIN_OBSERVED_DAYS,
): ActionVisibilityPoint[] =>
  Array.from({ length: days }, (_, index) => ({
    date: day(days - index),
    visibility: value,
  }));

const HOME = marketKeywords('us', 10);
const MARKET = marketKeywords('de', MARKET_MIN_KEYWORDS);

const app = (overrides: Partial<ActionContextApp> = {}): ActionContextApp => ({
  id: 'app_1',
  name: 'Budget',
  store: 'APP_STORE',
  storeAppId: 'own-app',
  country: 'us',
  trackedKeywords: [...HOME, ...MARKET],
  keywordsByCountry: new Map([
    ['us', HOME],
    ['de', MARKET],
  ]),
  coverage: [],
  metadataFields: [],
  audit: null,
  changeEvents: [],
  visibilityByCountry: new Map([
    ['us', series(44.7)],
    ['de', series(18.2)],
  ]),
  rankingDaysByKeyword: new Map(),
  serpDaysByKeyword: new Map(),
  volatilityByKeyword: new Map(),
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

describe('market.improve_country', () => {
  it('registers for its rule', () => {
    expect(marketImproveCountryDetector.rule).toBe('market.improve_country');
  });

  it('returns nothing for an empty context', () => {
    expect(detectMarketImproveCountry(context([]), NOW)).toEqual([]);
  });

  it('fires on a market visibly behind the home market', () => {
    const detections = detectMarketImproveCountry(context([app()]), NOW);

    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({
      rule: 'market.improve_country',
      appId: 'app_1',
      country: 'de',
      keywordId: null,
      discriminator: null,
    });
    expect(
      detections[0].evidence as MarketImproveCountryEvidence,
    ).toMatchObject({
      country: 'de',
      homeCountry: 'us',
      marketVisibility: 18.2,
      homeVisibility: 44.7,
      gap: 26.5,
      trackedKeywords: MARKET_MIN_KEYWORDS,
      rankedKeywords: MARKET_MIN_KEYWORDS,
      windowDays: MARKET_WINDOW_DAYS,
    });
  });

  it('never reports the home market as underperforming itself', () => {
    const detections = detectMarketImproveCountry(context([app()]), NOW);

    expect(detections.map((detection) => detection.country)).not.toContain(
      'us',
    );
  });

  it('never fires for a single-market app', () => {
    expect(
      detectMarketImproveCountry(
        context([
          app({
            trackedKeywords: HOME,
            keywordsByCountry: new Map([['us', HOME]]),
            visibilityByCountry: new Map([['us', series(44.7)]]),
          }),
        ]),
        NOW,
      ),
    ).toEqual([]);
  });

  it('fires at exactly the minimum keyword count and not below', () => {
    const withCount = (count: number): number => {
      const market = marketKeywords('de', count);
      return detectMarketImproveCountry(
        context([
          app({
            trackedKeywords: [...HOME, ...market],
            keywordsByCountry: new Map([
              ['us', HOME],
              ['de', market],
            ]),
          }),
        ]),
        NOW,
      ).length;
    };

    expect(withCount(MARKET_MIN_KEYWORDS)).toBe(1);
    expect(withCount(MARKET_MIN_KEYWORDS - 1)).toBe(0);
  });

  it('fires at exactly the minimum gap and not below', () => {
    const withGap = (gap: number): number =>
      detectMarketImproveCountry(
        context([
          app({
            visibilityByCountry: new Map([
              ['us', series(44.7)],
              ['de', series(Math.round((44.7 - gap) * 10) / 10)],
            ]),
          }),
        ]),
        NOW,
      ).length;

    expect(withGap(MARKET_MIN_GAP)).toBe(1);
    expect(withGap(MARKET_MIN_GAP - 0.1)).toBe(0);
  });

  it('never fires when the markets perform equally', () => {
    expect(
      detectMarketImproveCountry(
        context([
          app({
            visibilityByCountry: new Map([
              ['us', series(30)],
              ['de', series(30)],
            ]),
          }),
        ]),
        NOW,
      ),
    ).toEqual([]);
  });

  it('needs enough observed days in both markets', () => {
    expect(
      detectMarketImproveCountry(
        context([
          app({
            visibilityByCountry: new Map([
              ['us', series(44.7)],
              ['de', series(18.2, MARKET_MIN_OBSERVED_DAYS - 1)],
            ]),
          }),
        ]),
        NOW,
      ),
    ).toEqual([]);
    expect(
      detectMarketImproveCountry(
        context([
          app({
            visibilityByCountry: new Map([
              ['us', series(44.7, MARKET_MIN_OBSERVED_DAYS - 1)],
              ['de', series(18.2)],
            ]),
          }),
        ]),
        NOW,
      ),
    ).toEqual([]);
  });

  it('stays silent for a market with keywords but no rankings yet', () => {
    expect(
      detectMarketImproveCountry(
        context([
          app({
            visibilityByCountry: new Map([['us', series(44.7)]]),
          }),
        ]),
        NOW,
      ),
    ).toEqual([]);
  });

  it('ignores visibility older than the window', () => {
    const stale = (value: number): ActionVisibilityPoint[] =>
      Array.from({ length: MARKET_MIN_OBSERVED_DAYS }, (_, index) => ({
        date: day(MARKET_WINDOW_DAYS + 1 + index),
        visibility: value,
      }));

    expect(
      detectMarketImproveCountry(
        context([
          app({
            visibilityByCountry: new Map([
              ['us', stale(44.7)],
              ['de', stale(18.2)],
            ]),
          }),
        ]),
        NOW,
      ),
    ).toEqual([]);
  });

  it('reports an inactive-heavy market by its active keywords only', () => {
    const market = [
      ...marketKeywords('de', MARKET_MIN_KEYWORDS),
      ...marketKeywords('de', 3, { active: false }).map((item, index) => ({
        ...item,
        keywordId: `de_inactive_${index}`,
      })),
    ];

    const detections = detectMarketImproveCountry(
      context([
        app({
          trackedKeywords: [...HOME, ...market],
          keywordsByCountry: new Map([
            ['us', HOME],
            ['de', market],
          ]),
        }),
      ]),
      NOW,
    );

    expect(
      (detections[0].evidence as MarketImproveCountryEvidence).trackedKeywords,
    ).toBe(MARKET_MIN_KEYWORDS);
  });
});
