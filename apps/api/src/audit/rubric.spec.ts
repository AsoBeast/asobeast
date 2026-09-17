import { Store } from '@prisma/client';
import {
  analyzedCreative,
  appStoreContext,
  competitor,
  FIXTURE_NOW,
  keyword,
  observations,
  playContext,
  reviewsFrom,
  screenshotObservation,
} from './audit-context.fixture';
import { AuditContext, AuditKeyword } from './audit-scoring';
import { titleChecks } from './checks/metadata-checks';
import { ratingChecks } from './checks/reputation-checks';
import {
  AUDIT_GROUP_LABELS,
  AUDIT_RUBRIC_VERSION,
  AUDIT_WEIGHTS,
  computeAudit,
} from './rubric';

const emptyContext = (): AuditContext => appStoreContext();

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
].map((text) => keyword(text, 'longtail', 10, { source: 'KEYWORD_FIELD' }));

const perfectKeywords: AuditKeyword[] = [
  keyword('habit tracker', 'primary', 90, { source: 'TITLE', position: 1 }),
  keyword('streak counter', 'secondary', 70, {
    source: 'SUBTITLE',
    position: 3,
  }),
  keyword('goal log', 'secondary', 60, { source: 'SUBTITLE', position: 5 }),
  ...keywordFieldEntries,
];

const perfectKeywordField = keywordFieldEntries
  .map((entry) => entry.text)
  .join(',');

const perfectContext = (): AuditContext =>
  appStoreContext({
    title: 'Habit Tracker: Daily Streaks',
    subtitle: 'Streak Counter and Goal Log',
    summary:
      'Streak counter and goal log to keep every routine moving forward now',
    keywordField: perfectKeywordField,
    competitors: [
      competitor({
        id: 'c1',
        name: 'Pomodoro Labs',
        title: 'Pomodoro Focus Timer',
        ratingCount: 100_000,
      }),
      competitor({
        id: 'c2',
        name: 'Timer Works',
        title: 'Timer Works Pro',
        ratingCount: 200_000,
      }),
    ],
    reviews: reviewsFrom(FIXTURE_NOW, [5, 5, 5, 5, 5]),
    description:
      'Track your habits and reach your goals.\n• Loved by 2 million users. Download now to start today.',
    ratingAvg: 5,
    ratingCount: 1_000_000,
    storeUpdatedAt: FIXTURE_NOW,
    facts: {
      screenshotCount: 10,
      screenshotUrls: Array.from({ length: 10 }, (_, i) => `s${i}.png`),
      releaseNotes:
        'Adds streak reminders, home screen widgets and a weekly recap.',
      languages: ['EN', 'PL', 'DE', 'FR', 'ES', 'IT', 'PT', 'JA', 'KO', 'ZH'],
    },
    keywords: perfectKeywords,
    visibility: { latest: 60, latestDate: '2026-07-09', weekAgo: 55 },
    comparison: {
      competitors: [{ id: 'c1', name: 'Pomodoro Labs' }],
      rows: [
        {
          keywordId: 'k1',
          text: 'habit tracker',
          traffic: 8,
          difficulty: 3,
          you: 1,
          positions: { c1: 12 },
          gap: false,
        },
      ],
    },
    creative: analyzedCreative(Store.APP_STORE, {
      observations: observations({
        screenshots: [
          'Habit tracker streaks',
          'Streak counter daily',
          'Goal log weekly',
        ].map((captionText, index) =>
          screenshotObservation(index + 1, { captionText }),
        ),
      }),
      inputs: {
        store: Store.APP_STORE,
        country: 'us',
        title: 'Habit Tracker: Daily Streaks',
        iconUrl: 'https://cdn/icon.png',
        screenshotUrls: Array.from({ length: 10 }, (_, i) => `s${i}.png`),
        competitorIconUrls: ['c1.png', 'c2.png'],
      },
    }),
    aiStatus: {
      configured: true,
      model: 'gpt-5.6-luna',
      generatedAt: FIXTURE_NOW.toISOString(),
    },
  });

const perfectPlayContext = (): AuditContext =>
  playContext({
    ...perfectContext(),
    store: Store.GOOGLE_PLAY,
    facts: {
      screenshotCount: 8,
      screenshotUrls: Array.from({ length: 8 }, (_, i) => `p${i}.png`),
      releaseNotes:
        'Adds streak reminders, home screen widgets and a weekly recap.',
      featureGraphicUrl: 'https://play-lh.googleusercontent.com/header',
      videoUrl: 'https://play.google.com/video/x',
      privacyPolicyUrl: 'https://example.com/privacy',
    },
  });

const ids = (context: AuditContext): string[] =>
  computeAudit(context).factors.flatMap((factor) =>
    factor.checks.map((item) => item.id),
  );

describe('AUDIT_WEIGHTS', () => {
  it('weighs the App Store at 110 and Google Play at 105', () => {
    const total = (store: Store) =>
      Object.values(AUDIT_WEIGHTS[store]).reduce(
        (sum, weight) => sum + weight,
        0,
      );

    expect(AUDIT_WEIGHTS.APP_STORE).toMatchObject({
      title: 20,
      subtitle: 15,
      keywordField: 15,
      shortDescription: 0,
      description: 5,
      screenshots: 15,
      previewVideo: 5,
      ratings: 15,
      icon: 5,
      rankings: 10,
      conversion: 5,
    });
    expect(total('APP_STORE')).toBe(110);
    expect(total('GOOGLE_PLAY')).toBe(105);
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

  it('scores Google Play with its own fields', () => {
    const played = ids(perfectPlayContext());

    expect(played).toEqual(
      expect.arrayContaining([
        'short-description-keyword',
        'short-description-length',
        'short-description-no-repetition',
        'short-description-policy',
        'screenshots-feature-graphic',
        'preview-video-present',
      ]),
    );
    expect(
      played.filter(
        (id) => id.startsWith('subtitle-') || id.startsWith('keyword-field-'),
      ),
    ).toEqual([]);
  });

  it('names the Google Play screenshots factor after its feature graphic', () => {
    const labelOf = (context: AuditContext) =>
      computeAudit(context).factors.find(
        (factor) => factor.id === 'screenshots',
      )?.label;

    expect(labelOf(perfectPlayContext())).toBe(
      'Screenshots and feature graphic',
    );
    expect(labelOf(perfectContext())).toBe('Screenshots');
  });

  it('leaves no unanswered check without a way to answer it after an AI run', () => {
    const result = computeAudit(perfectContext());

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
    const withoutField = computeAudit({
      ...perfectContext(),
      keywords: [],
      keywordField: null,
    });
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

    expect(result.unlocks?.[0]).toMatchObject({
      kind: 'ai-analysis',
      label: 'Add OPENAI_API_KEY to analyze your icon and screenshots',
    });
    expect(result.unlocks?.[0].checks).toBeGreaterThan(0);
  });

  it('lists no check for promotional text, in-app events or custom product pages', () => {
    const all = [...ids(perfectContext()), ...ids(perfectPlayContext())];

    expect(all).not.toContain('conversion-promo');
    expect(all).not.toContain('conversion-events');
    expect(all).not.toContain('conversion-cpp');
    expect(all).not.toContain('ratings-prompts');
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
  it('scores an exact title phrase match higher than a partial match', () => {
    const primary = keyword('habit tracker', 'primary', 90);
    const phrase = titleChecks(
      appStoreContext({ title: 'Habit Tracker Pro', keywords: [primary] }),
    ).find((c) => c.id === 'title-keyword');
    const partial = titleChecks(
      appStoreContext({ title: 'Habit Builder', keywords: [primary] }),
    ).find((c) => c.id === 'title-keyword');
    expect(phrase?.score).toBe(10);
    expect(partial?.score).toBe(4);
  });

  it('maps rating averages onto the skill bands', () => {
    const scoreFor = (avg: number) =>
      ratingChecks(appStoreContext({ ratingAvg: avg })).find(
        (c) => c.id === 'ratings-average',
      )?.score ?? 0;
    expect(scoreFor(4.8)).toBeGreaterThanOrEqual(9);
    expect(scoreFor(4.2)).toBeGreaterThanOrEqual(5);
    expect(scoreFor(4.2)).toBeLessThanOrEqual(8);
    expect(scoreFor(3.5)).toBeLessThanOrEqual(4);
  });
});
