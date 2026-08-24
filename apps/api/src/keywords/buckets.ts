import { KeywordBucket, TrackedKeywordItem } from '@asobeast/shared';

const ASPIRATIONAL_VOLUME = 70;
const ASPIRATIONAL_DIFFICULTY100 = 70;
const PRIMARY_TOP = 5;
const LONGTAIL_MIN_WORDS = 3;
const LONGTAIL_MAX_VOLUME = 30;

const isScored = (item: TrackedKeywordItem): boolean =>
  item.opportunity !== null && item.volume !== null;

const isAspirational = (item: TrackedKeywordItem): boolean =>
  (item.volume ?? 0) >= ASPIRATIONAL_VOLUME &&
  (item.difficulty ?? 0) * 10 >= ASPIRATIONAL_DIFFICULTY100;

const wordCount = (text: string): number =>
  text.split(' ').filter(Boolean).length;

export function classifyBuckets(
  items: TrackedKeywordItem[],
): TrackedKeywordItem[] {
  const primaryIds = new Set(
    items
      .filter((item) => isScored(item) && !isAspirational(item))
      .sort((a, b) => (b.opportunity ?? 0) - (a.opportunity ?? 0))
      .slice(0, PRIMARY_TOP)
      .map((item) => item.keywordId),
  );

  const bucketFor = (item: TrackedKeywordItem): KeywordBucket | null => {
    if (!isScored(item)) {
      return null;
    }
    if (isAspirational(item)) {
      return 'aspirational';
    }
    if (primaryIds.has(item.keywordId)) {
      return 'primary';
    }
    if (
      wordCount(item.text) >= LONGTAIL_MIN_WORDS ||
      (item.volume ?? 0) < LONGTAIL_MAX_VOLUME
    ) {
      return 'longtail';
    }
    return 'secondary';
  };

  return items.map((item) => ({ ...item, bucket: bucketFor(item) }));
}
