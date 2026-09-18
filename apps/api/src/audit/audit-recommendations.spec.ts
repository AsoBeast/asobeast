import {
  AuditEffort,
  AuditRecommendation,
  AuditRecommendations,
} from '@asobeast/shared';
import {
  appStoreContext,
  keyword,
  poorAppStoreContext,
  poorPlayContext,
} from './audit-context.fixture';
import { round1, scoreAudit, scoreFactor } from './audit-engine';
import {
  ALL_AUDIT_CHECK_IDS,
  AuditContext,
  RubricCheck,
} from './audit-scoring';
import {
  bucketFor,
  CHECK_EFFORT,
  CHECK_TARGET,
  impactFor,
} from './audit-recommendations';
import { computeAudit, rubricFactors } from './rubric';

const ROUNDING_TOLERANCE = 0.1;

const bucketedItems = (
  recommendations: AuditRecommendations,
): AuditRecommendation[] => [
  ...recommendations.quickWins,
  ...recommendations.highImpact,
  ...recommendations.strategic,
];

const measured = (overall: number | null): number => {
  if (overall === null) {
    throw new Error('Expected a measurable overall score');
  }
  return overall;
};

const rubricChecks = (context: AuditContext): RubricCheck[] =>
  rubricFactors(context).flatMap((factor) => factor.checks);

const overallWithCheckAt10 = (
  context: AuditContext,
  checkId: string,
): number => {
  const factors = rubricFactors(context).map((factor) => {
    const checks = factor.checks.map((item) =>
      item.id === checkId ? { ...item, score: 10 } : item,
    );
    const { score, confidence } = scoreFactor(checks);
    return {
      weight: factor.weight,
      score,
      confidence,
      measurable: factor.checks.length > 0,
    };
  });
  return measured(scoreAudit(factors).overall);
};

describe('buildRecommendations', () => {
  it('has an effort and a target for every check id', () => {
    for (const id of ALL_AUDIT_CHECK_IDS) {
      expect(CHECK_EFFORT[id]).toBeDefined();
      expect(CHECK_TARGET[id]).toBeDefined();
    }
  });

  it('puts every advised warn or fail check in exactly one bucket, and nothing else', () => {
    const context = poorAppStoreContext();
    const result = computeAudit(context);
    const advised = rubricFactors(context)
      .flatMap((factor) =>
        factor.checks.map((item) => ({ factorId: factor.id, item })),
      )
      .filter(({ item }) => item.advice !== null)
      .map(({ factorId, item }) => `${factorId}/${item.id}`)
      .sort();
    const bucketed = [
      ...result.recommendations.quickWins,
      ...result.recommendations.highImpact,
      ...result.recommendations.strategic,
    ]
      .map((item) => `${item.factorId}/${item.checkId}`)
      .sort();

    expect(bucketed).toEqual(advised);
  });

  it('never leaves a warn or fail check without advice', () => {
    const unadvised = rubricChecks(poorAppStoreContext())
      .concat(rubricChecks(poorPlayContext()))
      .filter(
        (item) =>
          (item.status === 'warn' || item.status === 'fail') &&
          item.advice === null,
      )
      .map((item) => item.id);

    expect(unadvised).toEqual([]);
  });

  it('advises a warn even when nothing is missing to name', () => {
    const contexts = [
      appStoreContext({
        title: 'Geo Quiz',
        subtitle: 'World Map Trivia Game',
        keywords: [keyword('world map', 'secondary', 50)],
      }),
      appStoreContext({
        keywordField:
          'geoquiz,mapgame,atlasfun,flagquiz,capitalcity,bordergame',
        keywords: [
          keyword('geoquiz', 'longtail', 10, {
            source: 'KEYWORD_FIELD',
            relevance: 50,
          }),
        ],
      }),
      appStoreContext({
        visibility: { latest: 4, latestDate: '2026-07-09', weekAgo: null },
        keywords: [keyword('geo quiz', 'primary', 90, { position: 2 })],
      }),
    ];

    const unadvised = contexts
      .flatMap(rubricChecks)
      .filter(
        (item) =>
          (item.status === 'warn' || item.status === 'fail') &&
          item.advice === null,
      )
      .map((item) => item.id);

    expect(unadvised).toEqual([]);
  });

  it('computes lift as the overall with the check at 10 minus the overall', () => {
    const context = poorAppStoreContext();
    const result = computeAudit(context);
    const [first] = result.recommendations.quickWins;

    expect(first.lift).toBe(
      round1(
        overallWithCheckAt10(context, first.checkId) - measured(result.overall),
      ),
    );
    expect(first.lift).toBeGreaterThan(0);
  });

  it.each<[AuditEffort, number, keyof AuditRecommendations]>([
    ['minutes', 0.2, 'quickWins'],
    ['hours', 1, 'highImpact'],
    ['hours', 0.9, 'strategic'],
    ['weeks', 6, 'strategic'],
  ])('buckets %s effort with lift %s into %s', (effort, lift, bucket) => {
    expect(bucketFor(effort, lift)).toBe(bucket);
  });

  it.each([
    [0.9, 'low'],
    [1, 'medium'],
    [2.9, 'medium'],
    [3, 'high'],
  ])('rates lift %s as %s impact', (lift, impact) => {
    expect(impactFor(lift)).toBe(impact);
  });

  it('orders by lift, then factor weight, then check id, the same way every time', () => {
    const first = computeAudit(poorAppStoreContext()).recommendations;
    const second = computeAudit(poorAppStoreContext()).recommendations;

    expect(second).toEqual(first);
    expect(first.quickWins.map((item) => item.lift)).toEqual(
      [...first.quickWins.map((item) => item.lift)].sort(
        (a, b) => (b ?? 0) - (a ?? 0),
      ),
    );
  });

  it('bounds the potential by the best single lift and 100', () => {
    const result = computeAudit(poorAppStoreContext());
    const lifts = bucketedItems(result.recommendations).map(
      (item) => item.lift ?? 0,
    );

    expect(result.potential).toBeGreaterThanOrEqual(
      measured(result.overall) + Math.max(...lifts) - ROUNDING_TOLERANCE,
    );
    expect(result.potential).toBeLessThanOrEqual(100);
  });

  it('titles a recommendation with its advice and explains it with the evidence', () => {
    const result = computeAudit(poorAppStoreContext());
    const subtitle = bucketedItems(result.recommendations).find(
      (item) => item.checkId === 'subtitle-length',
    );

    expect(subtitle).toMatchObject({
      label: 'Add a subtitle',
      detail: '0 of 30 characters used.',
      effort: 'minutes',
      target: 'metadata',
    });
  });
});
