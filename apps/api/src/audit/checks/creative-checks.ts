import { Store } from '@prisma/client';
import {
  AuditScreenshotMessage,
  AuditUnlock,
  storefrontLanguage,
} from '@asobeast/shared';
import { round1 } from '../audit-engine';
import {
  aiUnlock,
  AuditContext,
  check,
  coversPhrase,
  currentObservations,
  KEYWORDS_UNLOCK,
  priorityKeywords,
  quoteList,
  RubricCheck,
  unansweredAiCheck,
} from '../audit-scoring';
import {
  CreativeObservations,
  ScreenshotObservation,
} from '../creative/creative-observations';

export const COMPETITOR_ICONS_UNLOCK: AuditUnlock = {
  kind: 'competitors',
  label: 'Add competitors to compare icons',
};

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

export const visibleScreenshots = (
  store: Store,
  count: number | null,
): number | null =>
  count === null
    ? null
    : store === Store.GOOGLE_PLAY
      ? Math.min(count, PLAY_SCREENSHOTS_PER_DEVICE)
      : count;

const countCheck = (context: AuditContext): RubricCheck | null => {
  const total = context.rawFacts.screenshotCount;
  if (total === null) {
    return null;
  }
  const play = context.store === Store.GOOGLE_PLAY;
  const counted = visibleScreenshots(context.store, total) as number;
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

export const CAPTION_SAMPLE = 3;
export const CAPTION_KEYWORD_BANDS = [
  { min: 3, score: 10 },
  { min: 2, score: 7 },
  { min: 1, score: 4 },
] as const;

export const FIRST_MESSAGE_SCORES: Readonly<
  Record<AuditScreenshotMessage, number>
> = Object.freeze({
  benefit: 10,
  'social-proof': 10,
  feature: 6,
  'ui-only': 2,
  other: 2,
  onboarding: 0,
});

export const FIRST_MESSAGE_LABELS: Readonly<
  Record<AuditScreenshotMessage, string>
> = Object.freeze({
  benefit: 'a benefit',
  'social-proof': 'social proof',
  feature: 'a feature',
  'ui-only': 'the interface only',
  other: 'something else',
  onboarding: 'an onboarding screen',
});

export const ICON_SIMPLICITY_SCORES: Readonly<Record<string, number>> =
  Object.freeze({ one: 10, two: 8, 'three-or-more': 4 });

export const ICON_CONTRAST_SCORES: Readonly<Record<string, number>> =
  Object.freeze({ high: 10, medium: 6, low: 2 });

const readableCaptions = (
  observations: CreativeObservations,
): ScreenshotObservation[] =>
  observations.screenshots.filter(
    (item) => item.captionReadable && item.captionText !== null,
  );

const captionChecks = (
  context: AuditContext,
  observations: CreativeObservations,
): RubricCheck[] => {
  const sample = observations.screenshots.slice(0, CAPTION_SAMPLE);
  const readable = sample.filter(
    (item) => item.captionReadable && item.captionText !== null,
  );
  const first = observations.screenshots.find((item) => item.position === 1);
  return [
    check({
      id: 'screenshots-captions',
      label: 'Readable captions',
      source: 'ai',
      weight: 2,
      score:
        sample.length === 0
          ? null
          : round1((readable.length / sample.length) * 10),
      detail:
        sample.length === 0
          ? 'No screenshot was analyzed.'
          : `${readable.length} of the first ${sample.length} screenshots carry a readable caption.`,
      unlock: aiUnlock(context),
      advice: {
        title: 'Add readable captions to your first screenshots',
        fix: `${sample.length - readable.length} of your first ${sample.length} screenshots have no readable caption. Put a 4 to 6 word benefit on each.`,
      },
    }),
    check({
      id: 'screenshots-first-message',
      label: 'First screenshot message',
      source: 'ai',
      weight: 2,
      score: first ? FIRST_MESSAGE_SCORES[first.message] : null,
      detail: first
        ? `The first screenshot shows ${FIRST_MESSAGE_LABELS[first.message]}.`
        : 'The first screenshot was not analyzed.',
      unlock: aiUnlock(context),
      advice: {
        title: 'Lead with a benefit in your first screenshot',
        fix: `It shows ${first ? FIRST_MESSAGE_LABELS[first.message] : 'nothing we could read'}${
          first?.captionText ? ` with \u201c${first.captionText}\u201d` : ''
        }. Most shoppers never scroll past the third screenshot.`,
      },
    }),
  ];
};

const captionKeywordCheck = (
  context: AuditContext,
  observations: CreativeObservations,
): RubricCheck | null => {
  if (context.store !== Store.APP_STORE) {
    return null;
  }
  const priority = priorityKeywords(context.keywords);
  const captions = readableCaptions(observations);
  const hits = priority.filter((keyword) =>
    captions.some((caption) =>
      coversPhrase(caption.captionText!, keyword.text),
    ),
  );
  return check({
    id: 'screenshots-caption-keywords',
    label: 'Keywords in captions',
    source: 'ai',
    weight: 2,
    score:
      priority.length === 0
        ? null
        : (CAPTION_KEYWORD_BANDS.find((band) => hits.length >= band.min)
            ?.score ?? 0),
    detail:
      priority.length === 0
        ? 'No priority keywords tracked to look for.'
        : `${hits.length} priority keywords appear in your captions.`,
    unlock: priority.length === 0 ? KEYWORDS_UNLOCK : aiUnlock(context),
    advice: {
      title: 'Use your keywords in screenshot captions',
      fix: `Apple has read caption text for search since June 2025. No caption mentions ${quoteList(
        priority.map((keyword) => keyword.text),
        2,
      )}.`,
    },
  });
};

const consistencyCheck = (
  context: AuditContext,
  observations: CreativeObservations,
): RubricCheck | null =>
  observations.consistentStyle === null
    ? null
    : check({
        id: 'screenshots-consistency',
        label: 'Consistent design',
        source: 'ai',
        weight: 1,
        score: observations.consistentStyle ? 10 : 4,
        detail: observations.consistentStyle
          ? 'The screenshots share one visual style.'
          : 'The screenshots mix visual styles.',
        unlock: aiUnlock(context),
        advice: {
          title: 'Give your screenshots one visual style',
          fix: 'Mixed palettes and layouts read as unfinished.',
        },
      });

const localizedCheck = (
  context: AuditContext,
  observations: CreativeObservations,
): RubricCheck | null => {
  if (context.store !== Store.APP_STORE) {
    return null;
  }
  const expected = storefrontLanguage(context.country);
  const captions = readableCaptions(observations).filter(
    (item) => item.captionLanguage !== null,
  );
  if (expected === null || captions.length === 0) {
    return null;
  }
  const declared = context.rawFacts.languages.map((code) => code.toLowerCase());
  const found = [
    ...new Set(captions.map((item) => item.captionLanguage as string)),
  ];
  const declaresExpected = declared.includes(expected);
  const matching = captions.filter((item) => item.captionLanguage === expected);
  const score = declaresExpected
    ? matching.length === captions.length
      ? 10
      : matching.length > 0
        ? 5
        : 0
    : captions.every((item) =>
          declared.includes(item.captionLanguage as string),
        )
      ? 10
      : 5;
  return check({
    id: 'screenshots-localized',
    label: 'Localized captions',
    source: 'ai',
    weight: 1,
    score,
    detail: `Captions are in ${found.join(', ')}; the ${context.country.toUpperCase()} storefront reads ${expected}.`,
    unlock: aiUnlock(context),
    advice: declaresExpected
      ? {
          title: `Localize your captions for ${expected}`,
          fix: `Your app supports ${expected} but the captions are in ${found.join(', ')}.`,
        }
      : {
          title: 'Write your captions in a language your app supports',
          fix: `The captions are in ${found.join(', ')}, which your app does not list.`,
        },
  });
};

export const screenshotChecks = (context: AuditContext): RubricCheck[] => {
  const fixed = [
    countCheck(context),
    ipadCheck(context),
    featureGraphicCheck(context),
  ].filter((item): item is RubricCheck => item !== null);
  const observations = currentObservations(context);
  if (observations === null) {
    return [
      ...fixed,
      unansweredAiCheck(
        'screenshots-captions',
        'Readable captions',
        2,
        context,
      ),
      unansweredAiCheck(
        'screenshots-first-message',
        'First screenshot message',
        2,
        context,
      ),
      ...(context.store === Store.APP_STORE
        ? [
            unansweredAiCheck(
              'screenshots-caption-keywords',
              'Keywords in captions',
              2,
              context,
            ),
          ]
        : []),
      unansweredAiCheck(
        'screenshots-consistency',
        'Consistent design',
        1,
        context,
      ),
    ];
  }
  return [
    ...fixed,
    ...captionChecks(context, observations),
    ...[
      captionKeywordCheck(context, observations),
      consistencyCheck(context, observations),
      localizedCheck(context, observations),
    ].filter((item): item is RubricCheck => item !== null),
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

export const iconChecks = (context: AuditContext): RubricCheck[] => {
  const observations = currentObservations(context);
  const icon = observations?.icon ?? null;
  if (icon === null) {
    return [
      unansweredAiCheck('icon-no-text', 'No text', 1, context),
      unansweredAiCheck('icon-simplicity', 'Simplicity', 2, context),
      unansweredAiCheck('icon-contrast', 'Contrast', 1, context),
      unansweredAiCheck(
        'icon-distinct',
        'Distinct from competitors',
        2,
        context,
      ),
    ];
  }
  const similar =
    icon.similarCompetitorPosition === null
      ? null
      : (context.competitors[icon.similarCompetitorPosition - 1] ?? null);
  return [
    check({
      id: 'icon-no-text',
      label: 'No text',
      source: 'ai',
      weight: 1,
      score: icon.hasText ? 3 : 10,
      detail: icon.hasText
        ? 'The icon contains text.'
        : 'The icon contains no text.',
      unlock: aiUnlock(context),
      advice: {
        title: 'Remove text from your icon',
        fix: 'Text is unreadable at the 60 point size search results use.',
      },
    }),
    check({
      id: 'icon-simplicity',
      label: 'Simplicity',
      source: 'ai',
      weight: 2,
      score: ICON_SIMPLICITY_SCORES[icon.elementCount],
      detail: `The icon shows ${icon.elementCount.replace('-', ' ')} elements.`,
      unlock: aiUnlock(context),
      advice: {
        title: 'Simplify your icon to one or two elements',
        fix: 'Busy icons blur at small sizes; keep one recognizable mark.',
      },
    }),
    check({
      id: 'icon-contrast',
      label: 'Contrast',
      source: 'ai',
      weight: 1,
      score: ICON_CONTRAST_SCORES[icon.contrast],
      detail: `The icon separates from the store background with ${icon.contrast} contrast.`,
      unlock: aiUnlock(context),
      advice: {
        title: "Raise your icon's contrast",
        fix: 'It should separate from both light and dark store backgrounds.',
      },
    }),
    check({
      id: 'icon-distinct',
      label: 'Distinct from competitors',
      source: 'ai',
      weight: 2,
      score:
        context.creative.inputs.competitorIconUrls.length === 0
          ? null
          : similar === null
            ? 10
            : 3,
      detail:
        context.creative.inputs.competitorIconUrls.length === 0
          ? 'No competitor icon was sent.'
          : similar === null
            ? 'No competitor icon looks like yours.'
            : `${similar.name ?? 'A competitor'} has a similar icon.`,
      unlock: COMPETITOR_ICONS_UNLOCK,
      advice: {
        title: `Make your icon distinct from ${similar?.name ?? 'your competitors'}`,
        fix: 'Shoppers comparing results could mistake one for the other.',
      },
    }),
  ];
};
