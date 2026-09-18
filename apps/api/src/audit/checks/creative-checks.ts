import { Store } from '@prisma/client';
import { aiCheck, AuditContext, check, RubricCheck } from '../audit-scoring';

export const SCREENSHOT_COUNT_BANDS = [
  { min: 8, score: 10 },
  { min: 6, score: 8 },
  { min: 5, score: 7 },
  { min: 3, score: 4 },
  { min: 1, score: 2 },
] as const;

export const PLAY_SCREENSHOTS_PER_DEVICE = 8;
export const APP_STORE_SCREENSHOT_TARGET = 8;
export const IPAD_SCREENSHOT_TARGET = 3;

const countScore = (count: number): number =>
  SCREENSHOT_COUNT_BANDS.find((band) => count >= band.min)?.score ?? 0;

const ipadScore = (count: number): number => {
  if (count >= IPAD_SCREENSHOT_TARGET) return 10;
  return count >= 1 ? 5 : 0;
};

const visibleCount = (store: Store, count: number): number =>
  store === Store.GOOGLE_PLAY
    ? Math.min(count, PLAY_SCREENSHOTS_PER_DEVICE)
    : count;

export const visibleScreenshots = (
  store: Store,
  count: number | null,
): number | null => (count === null ? null : visibleCount(store, count));

const countCheck = (context: AuditContext): RubricCheck | null => {
  const total = context.rawFacts.screenshotCount;
  if (total === null) {
    return null;
  }
  const play = context.store === Store.GOOGLE_PLAY;
  const counted = visibleCount(context.store, total);
  return check({
    id: 'screenshots-count',
    label: 'All slots used',
    source: 'store',
    weight: 2,
    score: countScore(counted),
    detail: play
      ? `${total} screenshots were found across device types; Google Play shows up to ${PLAY_SCREENSHOTS_PER_DEVICE} per device type.`
      : `${total} of ${APP_STORE_SCREENSHOT_TARGET} recommended screenshots used.`,
    advice: play
      ? {
          title: `Use all ${PLAY_SCREENSHOTS_PER_DEVICE} phone screenshot slots`,
          fix: `Google Play shows up to ${PLAY_SCREENSHOTS_PER_DEVICE} per device type; ${total} were found across device types.`,
        }
      : {
          title: `Add ${APP_STORE_SCREENSHOT_TARGET - counted} more screenshots`,
          fix: `Search shows the first 3 and the page holds 10. Use at least ${APP_STORE_SCREENSHOT_TARGET} to cover your main benefits.`,
        },
  });
};

const ipadCheck = (context: AuditContext): RubricCheck | null => {
  if (!context.rawFacts.supportsIpad) {
    return null;
  }
  const count = context.rawFacts.ipadScreenshotCount ?? 0;
  return check({
    id: 'screenshots-ipad',
    label: 'iPad screenshots',
    source: 'store',
    weight: 1,
    score: ipadScore(count),
    detail: `${count} iPad screenshots found.`,
    advice: {
      title: 'Add iPad screenshots',
      fix: `Your app runs on iPad but shows ${count} iPad screenshots.`,
    },
  });
};

const featureGraphicCheck = (context: AuditContext): RubricCheck | null => {
  if (context.store !== Store.GOOGLE_PLAY) {
    return null;
  }
  const present = context.rawFacts.featureGraphicUrl !== null;
  return check({
    id: 'screenshots-feature-graphic',
    label: 'Feature graphic',
    source: 'store',
    weight: 2,
    score: present ? 10 : 0,
    detail: present ? 'A feature graphic is set.' : 'No feature graphic found.',
    advice: {
      title: 'Upload a feature graphic',
      fix: 'Google Play shows the 1024 by 500 feature graphic at the top of the listing and in featured placements.',
    },
  });
};

export const screenshotChecks = (context: AuditContext): RubricCheck[] => {
  const fixed = [
    countCheck(context),
    ipadCheck(context),
    featureGraphicCheck(context),
  ].filter((item): item is RubricCheck => item !== null);
  return [
    ...fixed,
    aiCheck(
      'screenshots-first-three',
      'First three most compelling',
      2,
      context,
    ),
    aiCheck('screenshots-text-overlays', 'Benefit-driven captions', 2, context),
    aiCheck('screenshots-consistent', 'Consistent design', 1, context),
    aiCheck('screenshots-localized', 'Localized', 1, context),
    aiCheck('screenshots-device-frames', 'Modern device frames', 1, context),
  ];
};

export const previewVideoChecks = (context: AuditContext): RubricCheck[] => {
  if (context.store !== Store.GOOGLE_PLAY) {
    return [];
  }
  const present = context.rawFacts.videoUrl !== null;
  return [
    check({
      id: 'preview-video-present',
      label: 'Promo video linked',
      source: 'store',
      weight: 1,
      score: present ? 10 : 0,
      detail: present ? 'A promo video is linked.' : 'No promo video linked.',
      advice: {
        title: 'Link a promo video',
        fix: 'Add a YouTube video on the listing. Few shoppers tap play on Google Play, so do this after your screenshots.',
      },
    }),
  ];
};

export const iconChecks = (context: AuditContext): RubricCheck[] => [
  aiCheck('icon-distinctive', 'Distinctive', 2, context),
  aiCheck('icon-simple', 'Simple', 2, context),
  aiCheck('icon-category-fit', 'Category fit', 1, context),
  aiCheck('icon-no-text', 'No text', 1, context),
];
