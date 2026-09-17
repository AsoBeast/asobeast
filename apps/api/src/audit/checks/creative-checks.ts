import { Store } from '@prisma/client';
import { aiCheck, AuditContext, check, RubricCheck } from '../audit-scoring';

export const screenshotChecks = (context: AuditContext): RubricCheck[] => {
  const count = context.rawFacts.screenshotCount;
  return [
    check({
      id: 'screenshots-count',
      label: 'All slots used',
      source: 'store',
      weight: 2,
      score: count,
      detail:
        count === null
          ? 'Screenshot count unavailable.'
          : `${count} of 10 slots used.`,
    }),
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
  const hasVideo = context.rawFacts.hasVideo;
  return [
    hasVideo === null
      ? aiCheck('preview-video-exists', 'Preview video exists', 1, context)
      : check({
          id: 'preview-video-exists',
          label: 'Preview video exists',
          source: 'store',
          weight: 1,
          score: hasVideo ? 10 : 0,
          detail: hasVideo ? 'Has a preview video.' : 'Add a preview video.',
        }),
  ];
};

export const iconChecks = (context: AuditContext): RubricCheck[] => [
  aiCheck('icon-distinctive', 'Distinctive', 2, context),
  aiCheck('icon-simple', 'Simple', 2, context),
  aiCheck('icon-category-fit', 'Category fit', 1, context),
  aiCheck('icon-no-text', 'No text', 1, context),
];
