import { AuditFixFactorEvidence, DailyBudget } from '@asobeast/shared';
import type {
  ActionAuditFactor,
  ActionAuditSnapshot,
  ActionContext,
  ActionContextApp,
} from '../action-context';
import {
  AUDIT_MAX_SNAPSHOT_AGE_DAYS,
  AUDIT_MIN_WEIGHT,
  AUDIT_WEAK_SCORE,
  auditFixFactorDetector,
  detectAuditFixFactor,
} from './audit-fix-factor';

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

const factor = (
  overrides: Partial<ActionAuditFactor> = {},
): ActionAuditFactor => ({
  id: 'screenshots',
  label: 'Screenshots',
  weight: 15,
  score: 3,
  checks: [
    {
      id: 'screenshots-count',
      label: 'Screenshot count',
      status: 'fail',
      score: 2,
    },
    {
      id: 'screenshots-localized',
      label: 'Localized screenshots',
      status: 'pass',
      score: 10,
    },
  ],
  ...overrides,
});

const snapshot = (
  overrides: Partial<ActionAuditSnapshot> = {},
): ActionAuditSnapshot => ({
  date: day(1),
  overall: 61,
  coveredWeight: 85,
  totalWeight: 100,
  factors: [factor()],
  ...overrides,
});

const app = (overrides: Partial<ActionContextApp> = {}): ActionContextApp => ({
  id: 'app_1',
  name: 'Budget',
  store: 'APP_STORE',
  storeAppId: 'own-app',
  country: 'us',
  trackedKeywords: [],
  keywordsByCountry: new Map(),
  coverage: [],
  metadataFields: [],
  audit: snapshot(),
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

describe('audit.fix_factor', () => {
  it('registers for its rule', () => {
    expect(auditFixFactorDetector.rule).toBe('audit.fix_factor');
  });

  it('returns nothing for an empty context', () => {
    expect(detectAuditFixFactor(context([]), NOW)).toEqual([]);
  });

  it('fires per weak, heavily weighted factor with the factor as discriminator', () => {
    const detections = detectAuditFixFactor(context([app()]), NOW);

    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({
      rule: 'audit.fix_factor',
      appId: 'app_1',
      country: 'us',
      keywordId: null,
      discriminator: 'screenshots',
      terms: { reach: 0.15, severity: 0.7, confidence: 0.85 },
    });
  });

  it('reports the failing and warning checks and the snapshot staleness', () => {
    const evidence = detectAuditFixFactor(context([app()]), NOW)[0]
      .evidence as AuditFixFactorEvidence;

    expect(evidence).toMatchObject({
      factorId: 'screenshots',
      factorLabel: 'Screenshots',
      score: 3,
      weight: 15,
      overall: 61,
      coveredWeight: 85,
      totalWeight: 100,
      auditDate: day(1),
    });
    expect(evidence.failingChecks).toEqual([
      {
        id: 'screenshots-count',
        label: 'Screenshot count',
        status: 'fail',
        score: 2,
      },
    ]);
  });

  it('gives every weak factor its own action', () => {
    const detections = detectAuditFixFactor(
      context([
        app({
          audit: snapshot({
            factors: [
              factor(),
              factor({ id: 'title', label: 'Title', weight: 20, score: 2 }),
            ],
          }),
        }),
      ]),
      NOW,
    );

    expect(detections.map((detection) => detection.discriminator)).toEqual([
      'screenshots',
      'title',
    ]);
  });

  it('fires just below the weak score and not at it', () => {
    const fires = (score: number): boolean =>
      detectAuditFixFactor(
        context([app({ audit: snapshot({ factors: [factor({ score })] }) })]),
        NOW,
      ).length > 0;

    expect(fires(AUDIT_WEAK_SCORE - 0.1)).toBe(true);
    expect(fires(AUDIT_WEAK_SCORE)).toBe(false);
  });

  it('fires at exactly the weight threshold and not below', () => {
    const fires = (weight: number): boolean =>
      detectAuditFixFactor(
        context([app({ audit: snapshot({ factors: [factor({ weight })] }) })]),
        NOW,
      ).length > 0;

    expect(fires(AUDIT_MIN_WEIGHT)).toBe(true);
    expect(fires(AUDIT_MIN_WEIGHT - 1)).toBe(false);
  });

  it('never recommends work from an unanswered check', () => {
    expect(
      detectAuditFixFactor(
        context([
          app({ audit: snapshot({ factors: [factor({ score: null })] }) }),
        ]),
        NOW,
      ),
    ).toEqual([]);
  });

  it('drops Apple-only zero-weight factors on Google Play', () => {
    const play = app({
      store: 'GOOGLE_PLAY',
      audit: snapshot({
        factors: [
          factor({ id: 'subtitle', label: 'Subtitle', weight: 0, score: 0 }),
          factor({
            id: 'keywordField',
            label: 'Keyword field',
            weight: 0,
            score: 0,
          }),
          factor({
            id: 'description',
            label: 'Description',
            weight: 15,
            score: 3,
          }),
        ],
      }),
    });

    expect(
      detectAuditFixFactor(context([play]), NOW).map(
        (detection) => detection.discriminator,
      ),
    ).toEqual(['description']);
  });

  it('accepts a snapshot at exactly the age limit and rejects an older one', () => {
    const fires = (age: number): boolean =>
      detectAuditFixFactor(
        context([app({ audit: snapshot({ date: day(age) }) })]),
        NOW,
      ).length > 0;

    expect(fires(AUDIT_MAX_SNAPSHOT_AGE_DAYS)).toBe(true);
    expect(fires(AUDIT_MAX_SNAPSHOT_AGE_DAYS + 1)).toBe(false);
  });

  it('stays silent with no audit snapshot at all', () => {
    expect(detectAuditFixFactor(context([app({ audit: null })]), NOW)).toEqual(
      [],
    );
  });

  it('stays silent when every factor is unanswered', () => {
    expect(
      detectAuditFixFactor(
        context([
          app({
            audit: snapshot({
              coveredWeight: 0,
              factors: [factor({ score: null }), factor({ score: null })],
            }),
          }),
        ]),
        NOW,
      ),
    ).toEqual([]);
  });

  it('stays silent on a rubric with no weight to divide by', () => {
    expect(
      detectAuditFixFactor(
        context([app({ audit: snapshot({ totalWeight: 0 }) })]),
        NOW,
      ),
    ).toEqual([]);
  });

  it('lowers confidence when half the rubric is unanswered', () => {
    const detections = detectAuditFixFactor(
      context([app({ audit: snapshot({ coveredWeight: 50 }) })]),
      NOW,
    );

    expect(detections[0].terms.confidence).toBe(0.5);
  });
});
