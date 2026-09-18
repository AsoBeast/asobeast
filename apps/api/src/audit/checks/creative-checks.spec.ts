import { Store } from '@prisma/client';
import {
  analyzedCreative,
  appStoreContext,
  ContextOverrides,
  keyword,
  observations,
  playContext,
  screenshotObservation,
} from '../audit-context.fixture';
import { AuditContext } from '../audit-scoring';
import {
  iconChecks,
  previewVideoChecks,
  screenshotChecks,
} from './creative-checks';

const shots = (count: number) =>
  Array.from({ length: count }, (_, index) => `s${index}.png`);

const checkOf = (checks: ReturnType<typeof screenshotChecks>, id: string) =>
  checks.find((item) => item.id === id);

describe('screenshots-count', () => {
  it('scores a Google Play listing with 24 screenshots across device types as full, and says so', () => {
    const result = screenshotChecks(
      playContext({
        facts: { screenshotUrls: shots(24), screenshotCount: 24 },
      }),
    );
    const count = checkOf(result, 'screenshots-count');

    expect(count?.score).toBe(10);
    expect(count?.detail).toBe(
      '24 screenshots were found across device types; Google Play shows up to 8 per device type.',
    );
    expect(count?.detail).not.toContain('of 10');
  });

  it.each([
    [0, 0],
    [1, 2],
    [2, 2],
    [3, 4],
    [4, 4],
    [5, 7],
    [6, 8],
    [7, 8],
    [8, 10],
    [10, 10],
  ])('scores %i App Store screenshots as %i', (screenshots, score) => {
    const result = screenshotChecks(
      appStoreContext({
        facts: {
          screenshotUrls: shots(screenshots),
          screenshotCount: screenshots,
        },
      }),
    );

    expect(checkOf(result, 'screenshots-count')?.score).toBe(score);
  });

  it('omits the count when the payload carries no screenshot array', () => {
    const result = screenshotChecks(appStoreContext());

    expect(checkOf(result, 'screenshots-count')).toBeUndefined();
  });

  it.each([
    [0, 0],
    [1, 5],
    [2, 5],
    [3, 10],
  ])(
    'scores %i iPad screenshots as %i when the app runs on iPad',
    (ipad, score) => {
      const result = screenshotChecks(
        appStoreContext({
          facts: {
            supportsIpad: true,
            screenshotCount: 8,
            screenshotUrls: shots(8),
            ipadScreenshotCount: ipad,
          },
        }),
      );

      expect(checkOf(result, 'screenshots-ipad')?.score).toBe(score);
    },
  );

  it('omits the iPad check when the app does not run on iPad', () => {
    const result = screenshotChecks(
      appStoreContext({
        facts: { screenshotCount: 8, screenshotUrls: shots(8) },
      }),
    );

    expect(checkOf(result, 'screenshots-ipad')).toBeUndefined();
  });

  it('scores the Google Play feature graphic from the header image', () => {
    const present = screenshotChecks(
      playContext({ facts: { featureGraphicUrl: 'https://play/header' } }),
    );
    const missing = screenshotChecks(playContext());

    expect(checkOf(present, 'screenshots-feature-graphic')?.score).toBe(10);
    expect(checkOf(missing, 'screenshots-feature-graphic')?.score).toBe(0);
    expect(
      checkOf(
        screenshotChecks(appStoreContext()),
        'screenshots-feature-graphic',
      ),
    ).toBeUndefined();
  });
});

describe('preview-video-present', () => {
  it('scores a linked Google Play video and fails a missing one', () => {
    const present = previewVideoChecks(
      playContext({ facts: { videoUrl: 'https://play.google.com/video/x' } }),
    );
    const missing = previewVideoChecks(playContext());

    expect(present[0]).toMatchObject({
      id: 'preview-video-present',
      score: 10,
      source: 'store',
    });
    expect(missing[0]).toMatchObject({
      id: 'preview-video-present',
      score: 0,
    });
  });

  it('lists nothing on the App Store', () => {
    expect(previewVideoChecks(appStoreContext())).toEqual([]);
  });
});

const analyzed = (
  overrides: ContextOverrides = {},
  captions: { captionText: string | null; captionLanguage: string | null }[] = [
    { captionText: 'Guess any place', captionLanguage: 'en' },
  ],
): AuditContext =>
  appStoreContext({
    facts: { screenshotCount: 6, screenshotUrls: shots(6), ...overrides.facts },
    ...overrides,
    creative: analyzedCreative(Store.APP_STORE, {
      observations: observations({
        screenshots: captions.map((caption, index) =>
          screenshotObservation(index + 1, caption),
        ),
      }),
      inputs: {
        store: Store.APP_STORE,
        country: 'us',
        title: 'Where Am I?',
        iconUrl: 'https://cdn/icon.png',
        screenshotUrls: shots(6),
        competitorIconUrls: ['c1.png'],
      },
    }),
  });

describe('a stale analysis', () => {
  const stale = (): AuditContext =>
    appStoreContext({
      facts: { screenshotCount: 6, screenshotUrls: shots(6) },
      creative: analyzedCreative(Store.APP_STORE, { stale: true }),
      aiStatus: { configured: true, model: 'gpt-5.6-luna', generatedAt: null },
    });

  it('treats every AI check as unanswered while the analysis is stale', () => {
    const checks = [
      ...screenshotChecks(stale()),
      ...iconChecks(stale()),
    ].filter((item) => item.source === 'ai');

    expect(checks.length).toBeGreaterThan(0);
    expect(
      checks.every(
        (item) => item.score === null && item.unlock?.kind === 'ai-analysis',
      ),
    ).toBe(true);
    expect(checks[0].unlock?.label).toBe(
      'Your icon or screenshots changed. Analyze them again.',
    );
  });
});

describe('screenshots-captions', () => {
  const withScreenshots = (
    screenshots: ReturnType<typeof screenshotObservation>[],
  ): AuditContext =>
    appStoreContext({
      facts: { screenshotCount: 6, screenshotUrls: shots(6) },
      creative: analyzedCreative(Store.APP_STORE, {
        observations: observations({ screenshots }),
      }),
    });

  it('samples the first screenshot positions, not the first observations returned', () => {
    const context = withScreenshots([
      screenshotObservation(3, { captionReadable: false, captionText: null }),
      screenshotObservation(4),
      screenshotObservation(5),
    ]);

    expect(
      checkOf(screenshotChecks(context), 'screenshots-captions'),
    ).toMatchObject({
      score: 0,
      detail: '0 of the first 1 screenshots carry a readable caption.',
    });
  });

  it('leaves the check unscored when none of the first positions was analyzed', () => {
    const context = withScreenshots([
      screenshotObservation(4),
      screenshotObservation(5),
      screenshotObservation(6),
    ]);

    expect(
      checkOf(screenshotChecks(context), 'screenshots-captions')?.score,
    ).toBeNull();
  });
});

describe('screenshots-localized', () => {
  it('passes English captions in the Polish storefront when the app declares no Polish', () => {
    const context = analyzed({
      country: 'pl',
      facts: {
        screenshotCount: 6,
        screenshotUrls: shots(6),
        languages: ['EN', 'FR', 'DE', 'HI', 'ID', 'IT', 'JA', 'KO', 'PT', 'ES'],
      },
    });

    expect(
      screenshotChecks(context).find(
        (item) => item.id === 'screenshots-localized',
      )?.score,
    ).toBe(10);
  });

  it('fails English captions in the Polish storefront when the app declares Polish', () => {
    const context = analyzed({
      country: 'pl',
      facts: {
        screenshotCount: 6,
        screenshotUrls: shots(6),
        languages: ['EN', 'PL'],
      },
    });

    expect(
      screenshotChecks(context).find(
        (item) => item.id === 'screenshots-localized',
      )?.score,
    ).toBe(0);
  });
});

describe('screenshots-caption-keywords', () => {
  it('scores the same however the model ordered the screenshots', () => {
    const ordered = analyzed(
      { keywords: [keyword('geo quiz', 'primary', 90)] },
      [
        { captionText: 'A geo quiz', captionLanguage: 'en' },
        { captionText: 'Second', captionLanguage: 'en' },
      ],
    );
    const reversed = analyzed(
      { keywords: [keyword('geo quiz', 'primary', 90)] },
      [
        { captionText: 'Second', captionLanguage: 'en' },
        { captionText: 'A geo quiz', captionLanguage: 'en' },
      ],
    );
    const scoreOf = (context: AuditContext) =>
      screenshotChecks(context).find(
        (item) => item.id === 'screenshots-caption-keywords',
      )?.score;

    expect(scoreOf(ordered)).toBe(scoreOf(reversed));
  });
});

describe('iconChecks', () => {
  it('reads the stored icon observation', () => {
    const checks = iconChecks(analyzed());

    expect(checks.map((item) => item.id)).toEqual([
      'icon-no-text',
      'icon-simplicity',
      'icon-contrast',
      'icon-distinct',
    ]);
    expect(checks.find((item) => item.id === 'icon-no-text')?.score).toBe(10);
    expect(checks.find((item) => item.id === 'icon-distinct')?.score).toBe(10);
  });

  it('waits for competitor icons before judging distinctness', () => {
    const context = appStoreContext({
      creative: analyzedCreative(Store.APP_STORE),
    });

    expect(
      iconChecks(context).find((item) => item.id === 'icon-distinct'),
    ).toMatchObject({ score: null, unlock: { kind: 'competitors' } });
  });
});
