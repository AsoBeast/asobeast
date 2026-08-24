import {
  DailyBudget,
  RankInvestigateDropEvidence,
  TrackedKeywordItem,
} from '@asobeast/shared';
import type {
  ActionChangeEvent,
  ActionContext,
  ActionContextApp,
  ActionRankingDay,
  ActionVisibilityPoint,
} from '../action-context';
import {
  detectRankInvestigateDrop,
  rankInvestigateDropDetector,
  REGRESSION_MIN_DROPPED_KEYWORDS,
  REGRESSION_MIN_OBSERVED_DAYS,
  REGRESSION_MIN_VISIBILITY_DROP,
  REGRESSION_RECOVERY_TOLERANCE,
  REGRESSION_WINDOW_DAYS,
} from './rank-investigate-drop';
import { VOLATILITY_THRESHOLD } from './serp-volatility';

const NOW = new Date('2026-07-30T03:00:00.000Z');

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

const day = (offset: number): string =>
  new Date(NOW.getTime() - offset * 86_400_000).toISOString().slice(0, 10);

const CHANGE_OFFSET = 6;
const CHANGED_AT = day(CHANGE_OFFSET);

const keyword = (
  keywordId: string,
  overrides: Partial<TrackedKeywordItem> = {},
): TrackedKeywordItem => ({
  keywordId,
  text: `phrase ${keywordId}`,
  country: 'us',
  source: 'MANUAL',
  active: true,
  latestPosition: 20,
  latestDepth: 200,
  previousPosition: 4,
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

const KEYWORDS = ['kw_1', 'kw_2', 'kw_3', 'kw_4'].map((id) => keyword(id));

const rankingDays = (from: number, to: number | null): ActionRankingDay[] => [
  { date: day(CHANGE_OFFSET + 2), position: from },
  { date: day(CHANGE_OFFSET + 1), position: from },
  { date: day(1), position: to },
];

const droppedHistory = (dropped: number): Map<string, ActionRankingDay[]> =>
  new Map(
    KEYWORDS.map((item, index) => [
      item.keywordId,
      rankingDays(4, index < dropped ? 30 : 4),
    ]),
  );

const visibility = (
  beforeValue: number,
  afterValue: number,
  days = REGRESSION_MIN_OBSERVED_DAYS,
): ActionVisibilityPoint[] => [
  ...Array.from({ length: days }, (_, index) => ({
    date: day(CHANGE_OFFSET + days - index),
    visibility: beforeValue,
  })),
  ...Array.from({ length: days }, (_, index) => ({
    date: day(Math.max(CHANGE_OFFSET - index, 0)),
    visibility: afterValue,
  })),
];

const change = (
  offset = CHANGE_OFFSET,
  field: ActionChangeEvent['field'] = 'title',
): ActionChangeEvent => ({
  field,
  capturedAt: new Date(NOW.getTime() - offset * 86_400_000),
});

const app = (overrides: Partial<ActionContextApp> = {}): ActionContextApp => ({
  id: 'app_1',
  name: 'Budget',
  store: 'APP_STORE',
  storeAppId: 'own-app',
  country: 'us',
  trackedKeywords: KEYWORDS,
  keywordsByCountry: new Map(),
  coverage: [],
  metadataFields: [],
  audit: null,
  changeEvents: [change()],
  visibilityByCountry: new Map([['us', visibility(42, 30)]]),
  rankingDaysByKeyword: droppedHistory(0),
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

const evidenceOf = (
  detections: ReturnType<typeof detectRankInvestigateDrop>,
): RankInvestigateDropEvidence =>
  detections[0].evidence as RankInvestigateDropEvidence;

describe('rank.investigate_drop', () => {
  it('registers for its rule', () => {
    expect(rankInvestigateDropDetector.rule).toBe('rank.investigate_drop');
  });

  it('returns nothing for an empty context', () => {
    expect(detectRankInvestigateDrop(context([]), NOW)).toEqual([]);
  });

  it('fires on a visibility fall after an indexed metadata change', () => {
    const detections = detectRankInvestigateDrop(context([app()]), NOW);

    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({
      rule: 'rank.investigate_drop',
      appId: 'app_1',
      country: 'us',
      keywordId: null,
      discriminator: CHANGED_AT,
    });
    expect(evidenceOf(detections)).toMatchObject({
      changedAt: CHANGED_AT,
      fields: ['title'],
      visibilityBefore: 42,
      visibilityAfter: 30,
      visibilityDelta: 12,
      windowDays: REGRESSION_WINDOW_DAYS,
      trackedKeywords: 4,
    });
  });

  it('fires on a cluster of rank drops even when visibility barely moved', () => {
    const detections = detectRankInvestigateDrop(
      context([
        app({
          visibilityByCountry: new Map([['us', visibility(42, 38)]]),
          rankingDaysByKeyword: droppedHistory(REGRESSION_MIN_DROPPED_KEYWORDS),
        }),
      ]),
      NOW,
    );

    expect(detections).toHaveLength(1);
    expect(evidenceOf(detections).droppedKeywords).toHaveLength(
      REGRESSION_MIN_DROPPED_KEYWORDS,
    );
    expect(detections[0].terms.reach).toBe(REGRESSION_MIN_DROPPED_KEYWORDS / 4);
  });

  it('stays silent below both the visibility and keyword thresholds', () => {
    expect(
      detectRankInvestigateDrop(
        context([
          app({
            visibilityByCountry: new Map([
              ['us', visibility(42, 42 - (REGRESSION_MIN_VISIBILITY_DROP - 1))],
            ]),
            rankingDaysByKeyword: droppedHistory(
              REGRESSION_MIN_DROPPED_KEYWORDS - 1,
            ),
          }),
        ]),
        NOW,
      ),
    ).toEqual([]);
  });

  it('fires at exactly the visibility drop threshold', () => {
    expect(
      detectRankInvestigateDrop(
        context([
          app({
            visibilityByCountry: new Map([
              ['us', visibility(42, 42 - REGRESSION_MIN_VISIBILITY_DROP)],
            ]),
          }),
        ]),
        NOW,
      ),
    ).toHaveLength(1);
  });

  it('stays silent when there was no indexed change at all', () => {
    expect(
      detectRankInvestigateDrop(context([app({ changeEvents: [] })]), NOW),
    ).toEqual([]);
  });

  it('ignores changes to fields the store does not index for search', () => {
    for (const field of ['price', 'icon', 'screenshots', 'whatsNew'] as const) {
      expect(
        detectRankInvestigateDrop(
          context([app({ changeEvents: [change(CHANGE_OFFSET, field)] })]),
          NOW,
        ),
      ).toEqual([]);
    }
  });

  it('ignores a change older than the window', () => {
    expect(
      detectRankInvestigateDrop(
        context([app({ changeEvents: [change(REGRESSION_WINDOW_DAYS + 1)] })]),
        NOW,
      ),
    ).toEqual([]);
  });

  it('groups several changes on one day into a single action', () => {
    const detections = detectRankInvestigateDrop(
      context([
        app({
          changeEvents: [
            change(CHANGE_OFFSET, 'title'),
            change(CHANGE_OFFSET, 'subtitle'),
          ],
        }),
      ]),
      NOW,
    );

    expect(detections).toHaveLength(1);
    expect(evidenceOf(detections).fields).toEqual(['subtitle', 'title']);
  });

  it('gives a later change its own fingerprint discriminator', () => {
    const detections = detectRankInvestigateDrop(
      context([
        app({
          changeEvents: [change(CHANGE_OFFSET), change(CHANGE_OFFSET + 3)],
          visibilityByCountry: new Map([['us', visibility(42, 30, 8)]]),
        }),
      ]),
      NOW,
    );

    expect(detections.map((detection) => detection.discriminator)).toEqual([
      day(CHANGE_OFFSET),
      day(CHANGE_OFFSET + 3),
    ]);
  });

  it('needs enough observed days on both sides of the change', () => {
    expect(
      detectRankInvestigateDrop(
        context([
          app({
            visibilityByCountry: new Map([
              ['us', visibility(42, 30, REGRESSION_MIN_OBSERVED_DAYS - 1)],
            ]),
          }),
        ]),
        NOW,
      ),
    ).toEqual([]);
  });

  it('stays silent when there is no visibility history at all', () => {
    expect(
      detectRankInvestigateDrop(
        context([app({ visibilityByCountry: new Map() })]),
        NOW,
      ),
    ).toEqual([]);
  });

  it('treats recovery within tolerance as resolved', () => {
    const recovered = detectRankInvestigateDrop(
      context([
        app({
          visibilityByCountry: new Map([
            ['us', visibility(42, 42 - REGRESSION_RECOVERY_TOLERANCE)],
          ]),
          rankingDaysByKeyword: droppedHistory(4),
        }),
      ]),
      NOW,
    );

    expect(recovered).toEqual([]);
  });

  it('damps confidence and flags the advisory on churning results', () => {
    const detections = detectRankInvestigateDrop(
      context([
        app({
          volatilityByKeyword: new Map(
            KEYWORDS.map((item) => [item.keywordId, VOLATILITY_THRESHOLD + 10]),
          ),
        }),
      ]),
      NOW,
    );

    expect(detections[0].terms.confidence).toBeLessThanOrEqual(0.3);
    expect(detections[0].dampenedBy).toBe('serp.hold_volatile');
    expect(evidenceOf(detections).meanVolatility).toBe(
      VOLATILITY_THRESHOLD + 10,
    );
  });
});
