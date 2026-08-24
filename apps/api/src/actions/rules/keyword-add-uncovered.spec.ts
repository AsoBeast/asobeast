import {
  DailyBudget,
  KeywordAddUncoveredEvidence,
  KeywordCoverageRow,
  MetadataFieldAudit,
  TrackedKeywordItem,
} from '@asobeast/shared';
import { ActionContext, ActionContextApp } from '../action-context';
import {
  detectKeywordAddUncovered,
  keywordAddUncoveredDetector,
  UNCOVERED_MIN_OPPORTUNITY,
  UNCOVERED_MIN_RELEVANCE,
  UNCOVERED_MIN_VOLUME,
} from './keyword-add-uncovered';

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
  latestPosition: null,
  latestDepth: null,
  previousPosition: null,
  positionDelta1d: null,
  positionDelta7d: null,
  traffic: 6.2,
  difficulty: 4.1,
  volume: 62,
  relevance: 80,
  opportunity: 66.5,
  bucket: null,
  scoredAt: '2026-07-29',
  scoreProvenance: {
    source: 'APPLE_SUGGEST_SEARCH',
    formulaVersion: 'app-store-v1',
    capturedAt: '2026-07-29',
    confidence: 'HIGH',
  },
  serpVolatility7d: null,
  ...overrides,
});

const APPLE_FIELDS: MetadataFieldAudit[] = [
  {
    field: 'title',
    value: 'Budget',
    chars: 6,
    limit: 30,
    indexed: true,
    issues: [],
  },
  {
    field: 'subtitle',
    value: 'Plan',
    chars: 4,
    limit: 30,
    indexed: true,
    issues: [],
  },
  {
    field: 'keywordField',
    value: 'money,save',
    chars: 10,
    limit: 100,
    indexed: true,
    issues: [],
  },
  {
    field: 'description',
    value: 'Long copy',
    chars: 9,
    limit: 4000,
    indexed: false,
    issues: [],
  },
];

const PLAY_FIELDS: MetadataFieldAudit[] = [
  {
    field: 'title',
    value: 'Budget',
    chars: 6,
    limit: 30,
    indexed: true,
    issues: [],
  },
  {
    field: 'shortDescription',
    value: 'Plan money',
    chars: 10,
    limit: 80,
    indexed: true,
    issues: [],
  },
  {
    field: 'description',
    value: 'Long copy',
    chars: 9,
    limit: 4000,
    indexed: true,
    issues: [],
  },
];

const coverage = (
  covered: Record<string, boolean>,
  keywordId = 'kw_1',
): KeywordCoverageRow => {
  const fields = Object.entries(covered).map(([field, isCovered]) => ({
    field: field as KeywordCoverageRow['fields'][number]['field'],
    covered: isCovered,
  }));
  return {
    keywordId,
    text: 'budget planner',
    bucket: null,
    fields,
    uncovered: fields.every((field) => !field.covered),
  };
};

const APPLE_UNCOVERED = coverage({
  title: false,
  subtitle: false,
  keywordField: false,
});

const app = (overrides: Partial<ActionContextApp> = {}): ActionContextApp => ({
  id: 'app_1',
  name: 'Budget',
  store: 'APP_STORE',
  storeAppId: '1000',
  country: 'us',
  trackedKeywords: [keyword()],
  keywordsByCountry: new Map(),
  coverage: [APPLE_UNCOVERED],
  metadataFields: APPLE_FIELDS,
  audit: null,
  changeEvents: [],
  visibilityByCountry: new Map(),
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

const evidenceOf = (
  detections: ReturnType<typeof detectKeywordAddUncovered>,
): KeywordAddUncoveredEvidence =>
  detections[0].evidence as KeywordAddUncoveredEvidence;

describe('keyword.add_uncovered', () => {
  it('registers as a read-only detector for its rule', () => {
    expect(keywordAddUncoveredDetector.rule).toBe('keyword.add_uncovered');
  });

  it('returns nothing for an empty context', () => {
    expect(detectKeywordAddUncovered(context([]))).toEqual([]);
  });

  it('fires on the worked example and scores it high', () => {
    const detections = detectKeywordAddUncovered(context([app()]));

    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({
      rule: 'keyword.add_uncovered',
      appId: 'app_1',
      country: 'us',
      keywordId: 'kw_1',
      discriminator: null,
      terms: { reach: 0.62, severity: 0.665, confidence: 1 },
    });
  });

  it('reports the indexed and uncovered fields plus keyword-field headroom', () => {
    const evidence = evidenceOf(detectKeywordAddUncovered(context([app()])));

    expect(evidence.indexedFields).toEqual([
      'title',
      'subtitle',
      'keywordField',
    ]);
    expect(evidence.uncoveredFields).toEqual([
      'title',
      'subtitle',
      'keywordField',
    ]);
    expect(evidence.keywordFieldCharsFree).toBe(90);
  });

  it('reports the full keyword field as free when the app has none yet', () => {
    const fields = APPLE_FIELDS.filter(
      (field) => field.field !== 'keywordField',
    );
    const evidence = evidenceOf(
      detectKeywordAddUncovered(context([app({ metadataFields: fields })])),
    );

    expect(evidence.keywordFieldCharsFree).toBe(100);
  });

  it('never reports keyword-field headroom on Google Play', () => {
    const play = app({
      store: 'GOOGLE_PLAY',
      metadataFields: PLAY_FIELDS,
      coverage: [
        coverage({ title: false, shortDescription: false, description: false }),
      ],
    });
    const evidence = evidenceOf(detectKeywordAddUncovered(context([play])));

    expect(evidence.keywordFieldCharsFree).toBeNull();
    expect(evidence.indexedFields).toEqual([
      'title',
      'shortDescription',
      'description',
    ]);
  });

  it('does not fire when Play covers the keyword in the long description', () => {
    const play = app({
      store: 'GOOGLE_PLAY',
      metadataFields: PLAY_FIELDS,
      coverage: [
        coverage({ title: false, shortDescription: false, description: true }),
      ],
    });

    expect(detectKeywordAddUncovered(context([play]))).toEqual([]);
  });

  it('does not fire when the title already covers the keyword', () => {
    const covered = app({
      coverage: [
        coverage({ title: true, subtitle: false, keywordField: false }),
      ],
    });

    expect(detectKeywordAddUncovered(context([covered]))).toEqual([]);
  });

  describe('thresholds', () => {
    const fires = (overrides: Partial<TrackedKeywordItem>): boolean =>
      detectKeywordAddUncovered(
        context([app({ trackedKeywords: [keyword(overrides)] })]),
      ).length > 0;

    it('fires at exactly the opportunity threshold and not below', () => {
      expect(fires({ opportunity: UNCOVERED_MIN_OPPORTUNITY })).toBe(true);
      expect(fires({ opportunity: UNCOVERED_MIN_OPPORTUNITY - 0.1 })).toBe(
        false,
      );
    });

    it('fires at exactly the relevance threshold and not below', () => {
      expect(fires({ relevance: UNCOVERED_MIN_RELEVANCE })).toBe(true);
      expect(fires({ relevance: UNCOVERED_MIN_RELEVANCE - 1 })).toBe(false);
    });

    it('fires at exactly the volume threshold and not below', () => {
      expect(fires({ volume: UNCOVERED_MIN_VOLUME })).toBe(true);
      expect(fires({ volume: UNCOVERED_MIN_VOLUME - 1 })).toBe(false);
    });

    it('skips a keyword with no relevance, no volume or no opportunity', () => {
      expect(fires({ relevance: null })).toBe(false);
      expect(fires({ volume: null })).toBe(false);
      expect(fires({ opportunity: null })).toBe(false);
    });

    it('skips an inactive keyword', () => {
      expect(fires({ active: false })).toBe(false);
    });
  });

  it('never fires outside the home market', () => {
    const foreign = app({
      trackedKeywords: [keyword({ country: 'de' })],
    });

    expect(detectKeywordAddUncovered(context([foreign]))).toEqual([]);
  });

  it('lowers confidence for weaker score provenance', () => {
    const confidenceOf = (
      confidence: 'HIGH' | 'MEDIUM' | 'LOW' | null,
    ): number =>
      detectKeywordAddUncovered(
        context([
          app({
            trackedKeywords: [
              keyword({
                scoreProvenance:
                  confidence === null
                    ? null
                    : {
                        source: 'APPLE_SUGGEST_SEARCH',
                        formulaVersion: 'app-store-v1',
                        capturedAt: '2026-07-29',
                        confidence,
                      },
              }),
            ],
          }),
        ]),
      )[0].terms.confidence;

    expect(confidenceOf('HIGH')).toBe(1);
    expect(confidenceOf('MEDIUM')).toBe(0.6);
    expect(confidenceOf('LOW')).toBe(0.3);
    expect(confidenceOf(null)).toBe(0.3);
  });

  it('skips a keyword with no coverage row at all', () => {
    expect(detectKeywordAddUncovered(context([app({ coverage: [] })]))).toEqual(
      [],
    );
  });

  it('handles an app tracking no keywords', () => {
    expect(
      detectKeywordAddUncovered(context([app({ trackedKeywords: [] })])),
    ).toEqual([]);
  });
});
