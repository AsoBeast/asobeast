import { AuditCheckSource } from '@asobeast/shared';
import {
  aiUnlock,
  AuditContext,
  check,
  coversPhrase,
  KEYWORDS_UNLOCK,
  priorityKeywords,
  quoteList,
  RubricCheck,
} from '../audit-scoring';

export const CAPTION_KEYWORD_BANDS = [
  { min: 3, score: 10 },
  { min: 2, score: 7 },
  { min: 1, score: 4 },
] as const;

export const captionKeywordsCheck = (
  context: AuditContext,
  texts: readonly string[],
  source: Extract<AuditCheckSource, 'ai' | 'keywords'>,
): RubricCheck => {
  const priority = priorityKeywords(context.keywords);
  const hits = priority.filter((keyword) =>
    texts.some((text) => coversPhrase(text, keyword.text)),
  );
  return check({
    id: 'screenshots-caption-keywords',
    label: 'Keywords in captions',
    source,
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
    unlock:
      priority.length === 0
        ? KEYWORDS_UNLOCK
        : source === 'ai'
          ? aiUnlock(context)
          : null,
    advice: {
      title: 'Use your keywords in screenshot captions',
      fix: `Apple has reportedly read caption text for search since June 2025, though it has not confirmed it. No caption mentions ${quoteList(
        priority.map((keyword) => keyword.text),
        2,
      )}.`,
    },
  });
};
