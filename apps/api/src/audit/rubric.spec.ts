import {
  AUDIT_GROUP_LABELS,
  AUDIT_RUBRIC_VERSION,
  AUDIT_WEIGHTS,
  computeAudit,
} from './rubric';
import { previewVideoChecks } from './checks/creative-checks';
import { titleChecks } from './checks/metadata-checks';
import { ratingChecks } from './checks/reputation-checks';
import { AuditContext, AuditKeyword } from './audit-scoring';

const emptyFacts = {
  screenshotCount: null,
  ipadScreenshotCount: null,
  genres: [],
  releaseNotes: null,
  languages: [],
  contentRating: null,
  genreKey: null,
  genreName: null,
  hasVideo: null,
  iconUrl: null,
  screenshotUrls: [],
};

const NOW = new Date('2026-07-09T00:00:00.000Z');

const OBSERVABLE_IDS = [
  'screenshots-first-three',
  'screenshots-text-overlays',
  'screenshots-consistent',
  'screenshots-localized',
  'screenshots-device-frames',
  'icon-distinctive',
  'icon-simple',
  'icon-category-fit',
  'icon-no-text',
];

const UNOBSERVABLE_IDS = [
  'preview-video-exists',
  'preview-video-hook',
  'preview-video-length',
  'preview-video-sound',
  'ratings-responses',
  'ratings-prompts',
  'conversion-promo',
  'conversion-events',
  'conversion-cpp',
];

const answered = (ids: string[]) =>
  Object.fromEntries(
    ids.map((id) => [id, { score: 10, detail: 'Excellent.' }]),
  );

const observedAiChecks = answered(OBSERVABLE_IDS);

const perfectAiChecks = answered([...OBSERVABLE_IDS, ...UNOBSERVABLE_IDS]);

const emptyContext = (): AuditContext => ({
  appId: 'app1',
  store: 'APP_STORE',
  title: '',
  subtitle: null,
  description: '',
  ratingAvg: null,
  ratingCount: null,
  storeUpdatedAt: null,
  now: NOW,
  rawFacts: { ...emptyFacts },
  keywords: [],
  rankings: { top10Share: 0, rankedShare: 0, avgDelta7d: null, gapCount: 10 },
  history: { ratingAvgDelta30d: null, ratingCountDelta30d: null },
  competitorTitles: [],
  competitorNames: [],
  brandTokens: [],
  aiChecks: {},
  aiStatus: { configured: false, model: null, generatedAt: null },
});

const keywordFieldEntries: AuditKeyword[] = [
  'meditation',
  'mindfulness',
  'relaxation',
  'breathing',
  'wellness',
  'journal',
  'gratitude',
  'motivation',
  'calmness',
  'focusflow',
].map((text) => ({
  text,
  source: 'KEYWORD_FIELD',
  bucket: 'longtail',
  relevance: 100,
  position: 1,
}));

const perfectContext = (): AuditContext => ({
  appId: 'app1',
  store: 'APP_STORE',
  title: 'Habit Tracker: Daily Streaks',
  subtitle: 'Streak Counter and Reminders',
  description:
    'Track your habits and reach your goals.\n• Loved by 2 million users. Download now to start today.',
  ratingAvg: 5,
  ratingCount: 1_000_000,
  storeUpdatedAt: NOW,
  now: NOW,
  rawFacts: {
    ...emptyFacts,
    screenshotCount: 10,
    releaseNotes: 'New reminders and widgets.',
  },
  keywords: [
    {
      text: 'habit tracker',
      source: 'TITLE',
      bucket: 'primary',
      relevance: 100,
      position: 1,
    },
    {
      text: 'streak counter',
      source: 'SUBTITLE',
      bucket: 'secondary',
      relevance: 90,
      position: 3,
    },
    ...keywordFieldEntries,
  ],
  rankings: { top10Share: 1, rankedShare: 1, avgDelta7d: -1, gapCount: 0 },
  history: { ratingAvgDelta30d: 0.1, ratingCountDelta30d: 100 },
  competitorTitles: [],
  competitorNames: [],
  brandTokens: [],
  aiChecks: perfectAiChecks,
  aiStatus: {
    configured: true,
    model: 'gpt-4o',
    generatedAt: NOW.toISOString(),
  },
});

describe('AUDIT_WEIGHTS', () => {
  it('matches the ported factor weights', () => {
    const ios = AUDIT_WEIGHTS.APP_STORE;
    expect(ios).toMatchObject({
      title: 20,
      subtitle: 15,
      keywordField: 15,
      description: 5,
      screenshots: 15,
      previewVideo: 5,
      ratings: 15,
      icon: 5,
      rankings: 10,
      conversion: 5,
    });
    const iosSum = Object.values(ios).reduce((a, b) => a + b, 0);
    const androidSum = Object.values(AUDIT_WEIGHTS.GOOGLE_PLAY).reduce(
      (a, b) => a + b,
      0,
    );
    expect(iosSum).toBe(110);
    expect(androidSum).toBe(90);
  });
});

describe('computeAudit', () => {
  it('scores a perfect listing 100 over every measurable factor', () => {
    const result = computeAudit(perfectContext());
    const measurable = result.factors.filter(
      (factor) => factor.availability !== 'not-measurable',
    );
    expect(result.overall).toBe(100);
    expect(result.coveredWeight).toBe(105);
    expect(result.totalWeight).toBe(110);
    expect(measurable.every((factor) => factor.score === 10)).toBe(true);
    expect(measurable.some((factor) => factor.needsInput)).toBe(false);
  });

  it('scores an empty listing near zero and renormalizes over covered weight', () => {
    const result = computeAudit(emptyContext());
    expect(result.overall).not.toBeNull();
    expect(result.overall as number).toBeLessThan(35);
    expect(result.coveredWeight).toBe(55);
    expect(result.totalWeight).toBe(110);
  });

  it('marks factors with no resolvable checks as needsInput', () => {
    const result = computeAudit(emptyContext());
    const keywordField = result.factors.find((f) => f.id === 'keywordField');
    const ratings = result.factors.find((f) => f.id === 'ratings');
    expect(keywordField?.needsInput).toBe(true);
    expect(keywordField?.score).toBeNull();
    expect(ratings?.needsInput).toBe(true);
  });

  it('produces the same result for the same context on every call', () => {
    const context = perfectContext();

    expect(computeAudit(context)).toEqual(computeAudit(context));
  });

  it('marks needsInput exactly when the factor has no score and never covers more than it lists', () => {
    for (const result of [
      computeAudit(emptyContext()),
      computeAudit(perfectContext()),
    ]) {
      expect(result.rubricVersion).toBe(AUDIT_RUBRIC_VERSION);
      expect(result.coveredWeight).toBeLessThanOrEqual(result.totalWeight);
      for (const factor of result.factors) {
        expect(factor.needsInput).toBe(factor.score === null);
      }
    }
  });

  it('splits every factor between the two groups and grades the overall', () => {
    const result = computeAudit(perfectContext());

    expect(result.grade).toBe('A');
    expect(result.confidence).toBe(1);
    expect(result.groups?.map((group) => group.id)).toEqual([
      'discoverability',
      'conversion',
    ]);
    expect(result.groups?.map((group) => group.label)).toEqual(
      Object.values(AUDIT_GROUP_LABELS),
    );
    expect(result.groups?.every((group) => group.score === 10)).toBe(true);
    expect(result.factors.every((factor) => factor.group !== undefined)).toBe(
      true,
    );
    expect(
      result.factors
        .filter((factor) => factor.id !== 'previewVideo')
        .every((factor) => factor.availability === 'measured'),
    ).toBe(true);
  });

  it('leaves no unanswered check without a way to answer it after an AI run', () => {
    const result = computeAudit({
      ...perfectContext(),
      aiChecks: observedAiChecks,
    });

    const stuck = result.factors
      .flatMap((factor) => factor.checks)
      .filter((item) => item.status === 'unanswered' && !item.unlock);

    expect(stuck.map((item) => item.id)).toEqual([]);
  });

  it('lists no preview video check on the App Store and says so in the limitations', () => {
    const result = computeAudit(perfectContext());
    const video = result.factors.find((factor) => factor.id === 'previewVideo');

    expect(video).toMatchObject({
      checks: [],
      availability: 'not-measurable',
      score: null,
      needsInput: true,
    });
    expect(result.limitations?.map((item) => item.id)).toContain(
      'preview-video',
    );
  });

  it('waits for the keyword field instead of scoring without it', () => {
    const withoutField = computeAudit({ ...perfectContext(), keywords: [] });
    const field = withoutField.factors.find(
      (factor) => factor.id === 'keywordField',
    );

    expect(field?.availability).toBe('awaiting-input');
    expect(field?.checks).toEqual([
      expect.objectContaining({
        id: 'keyword-field-saved',
        status: 'unanswered',
        unlock: {
          kind: 'keyword-field',
          label: 'Paste your keyword field from App Store Connect',
        },
      }),
    ]);
  });

  it('offers the AI analysis before any other unlock when nothing has run', () => {
    const result = computeAudit(emptyContext());

    expect(result.unlocks?.map((item) => item.kind)).toEqual([
      'ai-analysis',
      'keyword-field',
      'history',
    ]);
    expect(result.unlocks?.[0]).toMatchObject({
      kind: 'ai-analysis',
      label: 'Add OPENAI_API_KEY to analyze your icon and screenshots',
    });
    expect(result.unlocks?.[0].checks).toBeGreaterThan(0);
  });

  it('lists no check for promotional text, in-app events or custom product pages', () => {
    const ids = [
      ...computeAudit(perfectContext()).factors,
      ...computeAudit({ ...perfectContext(), store: 'GOOGLE_PLAY' }).factors,
    ].flatMap((factor) => factor.checks.map((item) => item.id));

    expect(ids).not.toContain('conversion-promo');
    expect(ids).not.toContain('conversion-events');
    expect(ids).not.toContain('conversion-cpp');
    expect(ids).not.toContain('ratings-prompts');
  });

  it('produces recommendations for failing checks', () => {
    const result = computeAudit(emptyContext());
    const all = [
      ...result.recommendations.quickWins,
      ...result.recommendations.highImpact,
      ...result.recommendations.strategic,
    ];
    expect(all.length).toBeGreaterThan(0);
    expect(
      result.recommendations.quickWins.some((r) => r.factorId === 'title'),
    ).toBe(true);
  });
});

describe('factor bands', () => {
  const withContext = (overrides: Partial<AuditContext>): AuditContext => ({
    ...emptyContext(),
    ...overrides,
  });

  it('scores an exact title phrase match higher than a partial match', () => {
    const primary: AuditKeyword = {
      text: 'habit tracker',
      source: 'TITLE',
      bucket: 'primary',
      relevance: 100,
      position: 1,
    };
    const phrase = titleChecks(
      withContext({ title: 'Habit Tracker Pro', keywords: [primary] }),
    ).find((c) => c.id === 'title-keyword');
    const partial = titleChecks(
      withContext({ title: 'Habit Builder', keywords: [primary] }),
    ).find((c) => c.id === 'title-keyword');
    expect(phrase?.score).toBe(10);
    expect(partial?.score).toBe(4);
  });

  it('maps rating averages onto the skill bands', () => {
    const scoreFor = (avg: number) =>
      ratingChecks(withContext({ ratingAvg: avg })).find(
        (c) => c.id === 'ratings-average',
      )?.score ?? 0;
    expect(scoreFor(4.8)).toBeGreaterThanOrEqual(9);
    expect(scoreFor(4.2)).toBeGreaterThanOrEqual(5);
    expect(scoreFor(4.2)).toBeLessThanOrEqual(8);
    expect(scoreFor(3.5)).toBeLessThanOrEqual(4);
  });

  const previewExists = (context: AuditContext) =>
    previewVideoChecks(context).find((c) => c.id === 'preview-video-exists');

  const onPlay = (overrides: Partial<AuditContext>): AuditContext =>
    withContext({ store: 'GOOGLE_PLAY', ...overrides });

  it('lists no preview video check on the App Store', () => {
    expect(
      previewVideoChecks(
        withContext({ rawFacts: { ...emptyFacts, hasVideo: true } }),
      ),
    ).toEqual([]);
  });

  it('scores the Google Play preview video from data when hasVideo is known', () => {
    const present = previewExists(
      onPlay({ rawFacts: { ...emptyFacts, hasVideo: true } }),
    );
    const absent = previewExists(
      onPlay({ rawFacts: { ...emptyFacts, hasVideo: false } }),
    );
    expect(present?.kind).toBe('auto');
    expect(present?.score).toBe(10);
    expect(absent?.kind).toBe('auto');
    expect(absent?.score).toBe(0);
  });

  it('falls back to the AI check when hasVideo is null', () => {
    const answered = previewExists(
      onPlay({
        rawFacts: { ...emptyFacts, hasVideo: null },
        aiChecks: {
          'preview-video-exists': { score: 10, detail: 'Has a preview video.' },
        },
      }),
    );
    const unscored = previewExists(
      onPlay({ rawFacts: { ...emptyFacts, hasVideo: null } }),
    );
    expect(answered?.kind).toBe('ai');
    expect(answered?.score).toBe(10);
    expect(unscored?.score).toBeNull();
  });
});
