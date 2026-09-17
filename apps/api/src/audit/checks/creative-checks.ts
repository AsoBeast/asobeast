import { aiCheck, AuditContext, check, RubricCheck } from '../audit-scoring';

export const screenshotChecks = (context: AuditContext): RubricCheck[] => {
  const count = context.rawFacts.screenshotCount;
  const ai = context.aiChecks;
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
    aiCheck('screenshots-first-three', 'First three most compelling', 2, ai),
    aiCheck('screenshots-text-overlays', 'Benefit-driven captions', 2, ai),
    aiCheck('screenshots-consistent', 'Consistent design', 1, ai),
    aiCheck('screenshots-localized', 'Localized', 1, ai),
    aiCheck('screenshots-device-frames', 'Modern device frames', 1, ai),
  ];
};

export const previewVideoChecks = (context: AuditContext): RubricCheck[] => {
  const ai = context.aiChecks;
  const hasVideo = context.rawFacts.hasVideo;
  const previewVideoExists =
    hasVideo === null
      ? aiCheck('preview-video-exists', 'Preview video exists', 1, ai)
      : check({
          id: 'preview-video-exists',
          label: 'Preview video exists',
          source: 'store',
          weight: 1,
          score: hasVideo ? 10 : 0,
          detail: hasVideo ? 'Has a preview video.' : 'Add a preview video.',
        });
  return [
    previewVideoExists,
    aiCheck('preview-video-hook', 'Hook in first 3 seconds', 1, ai),
    aiCheck('preview-video-length', 'Optimal length', 1, ai),
    aiCheck('preview-video-sound', 'Works without sound', 1, ai),
  ];
};

export const iconChecks = (context: AuditContext): RubricCheck[] => {
  const ai = context.aiChecks;
  return [
    aiCheck('icon-distinctive', 'Distinctive', 2, ai),
    aiCheck('icon-simple', 'Simple', 2, ai),
    aiCheck('icon-category-fit', 'Category fit', 1, ai),
    aiCheck('icon-no-text', 'No text', 1, ai),
  ];
};
