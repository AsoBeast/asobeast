import { AuditCheckResult } from '@asobeast/shared';
import { clamp } from '../../scoring/formulas';
import { aiCheck, AuditContext, check } from '../audit-scoring';

export const screenshotChecks = (context: AuditContext): AuditCheckResult[] => {
  const count = context.rawFacts.screenshotCount;
  const ai = context.aiChecks;
  return [
    check(
      'screenshots-count',
      'All slots used',
      'auto',
      count === null ? null : clamp(count, 0, 10),
      count === null
        ? 'Screenshot count unavailable.'
        : `${count} of 10 slots used.`,
    ),
    aiCheck('screenshots-first-three', 'First three most compelling', ai),
    aiCheck('screenshots-text-overlays', 'Benefit-driven captions', ai),
    aiCheck('screenshots-consistent', 'Consistent design', ai),
    aiCheck('screenshots-localized', 'Localized', ai),
    aiCheck('screenshots-device-frames', 'Modern device frames', ai),
  ];
};

export const previewVideoChecks = (
  context: AuditContext,
): AuditCheckResult[] => {
  const ai = context.aiChecks;
  const hasVideo = context.rawFacts.hasVideo;
  const previewVideoExists =
    hasVideo === null
      ? aiCheck('preview-video-exists', 'Preview video exists', ai)
      : check(
          'preview-video-exists',
          'Preview video exists',
          'auto',
          hasVideo ? 10 : 0,
          hasVideo ? 'Has a preview video.' : 'Add a preview video.',
        );
  return [
    previewVideoExists,
    aiCheck('preview-video-hook', 'Hook in first 3 seconds', ai),
    aiCheck('preview-video-length', 'Optimal length', ai),
    aiCheck('preview-video-sound', 'Works without sound', ai),
  ];
};

export const iconChecks = (context: AuditContext): AuditCheckResult[] => {
  const ai = context.aiChecks;
  return [
    aiCheck('icon-distinctive', 'Distinctive', ai),
    aiCheck('icon-simple', 'Simple', ai),
    aiCheck('icon-category-fit', 'Category fit', ai),
    aiCheck('icon-no-text', 'No text', ai),
  ];
};
