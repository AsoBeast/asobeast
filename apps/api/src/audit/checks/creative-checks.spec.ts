import { appStoreContext, playContext } from '../audit-context.fixture';
import { previewVideoChecks, screenshotChecks } from './creative-checks';

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
