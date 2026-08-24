import { DailyBudget, ReviewsInvestigateThemeEvidence } from '@asobeast/shared';
import type {
  ActionContext,
  ActionContextApp,
  ActionReview,
} from '../action-context';
import {
  detectReviewsInvestigateTheme,
  REVIEW_THEME_MAX_PER_APP,
  REVIEW_THEME_MAX_SAMPLES,
  REVIEW_THEME_MIN_MENTIONS,
  REVIEW_THEME_MIN_VERSION_REVIEWS,
  REVIEW_THEME_WINDOW_DAYS,
  reviewsInvestigateThemeDetector,
} from './reviews-investigate-theme';

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

let sequence = 0;

const review = (
  version: string | null,
  score: number,
  text: string,
  overrides: Partial<ActionReview> = {},
): ActionReview => ({
  id: `rev_${(sequence += 1)}`,
  score,
  title: null,
  text,
  version,
  reviewedAt: new Date(NOW.getTime() - 86_400_000),
  ...overrides,
});

const CURRENT = '4.2.0';
const PREVIOUS = '4.1.0';

const defaultReviews = (): ActionReview[] => [
  review(CURRENT, 1, 'crashes on launch every single time'),
  review(CURRENT, 1, 'it crashes on launch after the update'),
  review(CURRENT, 2, 'crashes on launch when I open my budget'),
  review(CURRENT, 5, 'still love this planner'),
  review(CURRENT, 4, 'good planner overall'),
  review(PREVIOUS, 1, 'too many adverts in the free plan'),
  review(PREVIOUS, 2, 'adverts everywhere now'),
];

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
  audit: null,
  changeEvents: [],
  visibilityByCountry: new Map(),
  rankingDaysByKeyword: new Map(),
  serpDaysByKeyword: new Map(),
  volatilityByKeyword: new Map(),
  competitorAppIdsByStoreAppId: new Map(),
  reviews: defaultReviews(),
  latestVersion: CURRENT,
  previousVersion: PREVIOUS,
  ...overrides,
});

const context = (apps: ActionContextApp[]): ActionContext => ({
  workspaceId: 'ws_1',
  apps,
  budget,
  reviewScoreMax: 2,
  rankDropThreshold: 5,
});

const themes = (
  detections: ReturnType<typeof detectReviewsInvestigateTheme>,
): string[] =>
  detections.map(
    (detection) =>
      (detection.evidence as ReviewsInvestigateThemeEvidence).theme,
  );

describe('reviews.investigate_theme', () => {
  it('registers for its rule', () => {
    expect(reviewsInvestigateThemeDetector.rule).toBe(
      'reviews.investigate_theme',
    );
  });

  it('returns nothing for an empty context', () => {
    expect(detectReviewsInvestigateTheme(context([]), NOW)).toEqual([]);
  });

  it('fires on a theme new to the latest version', () => {
    const detections = detectReviewsInvestigateTheme(context([app()]), NOW);

    expect(detections.length).toBeGreaterThan(0);
    expect(themes(detections)).toContain('crashes on launch');
    expect(detections[0]).toMatchObject({
      rule: 'reviews.investigate_theme',
      appId: 'app_1',
      keywordId: null,
    });
  });

  it('discriminates by theme and version so a later return is a new action', () => {
    const detections = detectReviewsInvestigateTheme(context([app()]), NOW);
    const crash = detections.find(
      (detection) =>
        (detection.evidence as ReviewsInvestigateThemeEvidence).theme ===
        'crashes on launch',
    );

    expect(crash?.discriminator).toBe(`crashes on launch~${CURRENT}`);
  });

  it('carries review ids and never review bodies', () => {
    const detections = detectReviewsInvestigateTheme(context([app()]), NOW);
    const evidence = detections.find(
      (detection) =>
        (detection.evidence as ReviewsInvestigateThemeEvidence).theme ===
        'crashes on launch',
    )?.evidence as ReviewsInvestigateThemeEvidence;

    expect(evidence).toMatchObject({
      version: CURRENT,
      previousVersion: PREVIOUS,
      mentions: 3,
      previousMentions: 0,
      negativeReviews: 3,
      totalReviews: 5,
    });
    expect(evidence.sampleReviewIds.length).toBeLessThanOrEqual(
      REVIEW_THEME_MAX_SAMPLES,
    );
    expect(JSON.stringify(evidence)).not.toContain('crashes on launch every');
  });

  it('stays silent without a previous version to compare against', () => {
    expect(
      detectReviewsInvestigateTheme(
        context([app({ previousVersion: null })]),
        NOW,
      ),
    ).toEqual([]);
    expect(
      detectReviewsInvestigateTheme(
        context([app({ latestVersion: null })]),
        NOW,
      ),
    ).toEqual([]);
  });

  it('stays silent when the previous version has no negative reviews', () => {
    expect(
      detectReviewsInvestigateTheme(
        context([
          app({
            reviews: defaultReviews().filter(
              (item) => item.version !== PREVIOUS,
            ),
          }),
        ]),
        NOW,
      ),
    ).toEqual([]);
  });

  it('stays silent below the minimum reviews for the current version', () => {
    const thin = defaultReviews().filter(
      (item, index) => item.version !== CURRENT || index < 3,
    );

    expect(
      detectReviewsInvestigateTheme(context([app({ reviews: thin })]), NOW),
    ).toEqual([]);
    expect(REVIEW_THEME_MIN_VERSION_REVIEWS).toBe(5);
  });

  it('ignores a theme that was already there in the previous version', () => {
    const stable: ActionReview[] = [
      review(CURRENT, 1, 'too many adverts here'),
      review(CURRENT, 1, 'too many adverts always'),
      review(CURRENT, 2, 'too many adverts today'),
      review(CURRENT, 5, 'fine planner'),
      review(CURRENT, 4, 'good planner'),
      review(PREVIOUS, 1, 'too many adverts here'),
      review(PREVIOUS, 1, 'too many adverts always'),
      review(PREVIOUS, 2, 'too many adverts today'),
    ];

    expect(
      themes(
        detectReviewsInvestigateTheme(context([app({ reviews: stable })]), NOW),
      ),
    ).not.toContain('too many adverts');
  });

  it('needs at least the minimum mentions', () => {
    const sparse: ActionReview[] = [
      review(CURRENT, 1, 'battery drain problem'),
      review(CURRENT, 1, 'battery drain problem'),
      review(CURRENT, 5, 'great planner'),
      review(CURRENT, 4, 'great planner too'),
      review(CURRENT, 4, 'nice planner as well'),
      review(PREVIOUS, 1, 'adverts everywhere'),
    ];

    expect(
      themes(
        detectReviewsInvestigateTheme(context([app({ reviews: sparse })]), NOW),
      ),
    ).not.toContain('battery drain problem');
    expect(REVIEW_THEME_MIN_MENTIONS).toBe(3);
  });

  it('emits at most three themes per app per run', () => {
    expect(
      detectReviewsInvestigateTheme(context([app()]), NOW).length,
    ).toBeLessThanOrEqual(REVIEW_THEME_MAX_PER_APP);
  });

  it('ignores reviews older than the window', () => {
    const stale = defaultReviews().map((item) => ({
      ...item,
      reviewedAt: new Date(
        NOW.getTime() - (REVIEW_THEME_WINDOW_DAYS + 1) * 86_400_000,
      ),
    }));

    expect(
      detectReviewsInvestigateTheme(context([app({ reviews: stale })]), NOW),
    ).toEqual([]);
  });

  it('handles reviews with no version by treating them as unversioned', () => {
    const unversioned = defaultReviews().map((item) =>
      item.version === CURRENT ? { ...item, version: null } : item,
    );

    expect(
      detectReviewsInvestigateTheme(
        context([app({ reviews: unversioned })]),
        NOW,
      ),
    ).toEqual([]);
  });

  it('handles non-ascii review text without crashing', () => {
    const international: ActionReview[] = [
      review(CURRENT, 1, 'アプリ 起動 できない 毎回'),
      review(CURRENT, 1, 'アプリ 起動 できない ずっと'),
      review(CURRENT, 2, 'アプリ 起動 できない 今日'),
      review(CURRENT, 5, 'とても 便利 です'),
      review(CURRENT, 4, 'まあまあ 便利 です'),
      review(PREVIOUS, 1, '広告 が 多い'),
    ];

    expect(() =>
      detectReviewsInvestigateTheme(
        context([app({ reviews: international })]),
        NOW,
      ),
    ).not.toThrow();
  });

  it('stays silent with no reviews at all', () => {
    expect(
      detectReviewsInvestigateTheme(context([app({ reviews: [] })]), NOW),
    ).toEqual([]);
  });
});
