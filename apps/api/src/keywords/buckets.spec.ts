import { TrackedKeywordItem } from '@asobeast/shared';
import { classifyBuckets } from './buckets';

const item = (
  overrides: Partial<TrackedKeywordItem> & { keywordId: string },
): TrackedKeywordItem => ({
  text: 'keyword',
  source: 'MANUAL',
  active: true,
  latestPosition: null,
  positionDelta7d: null,
  traffic: 5,
  difficulty: 4,
  volume: 50,
  relevance: 80,
  opportunity: 50,
  bucket: null,
  scoredAt: '2026-07-01',
  scoreProvenance: null,
  ...overrides,
});

const bucketOf = (items: TrackedKeywordItem[], id: string) =>
  classifyBuckets(items).find((i) => i.keywordId === id)?.bucket;

describe('classifyBuckets', () => {
  it('marks high volume and high difficulty keywords aspirational', () => {
    const items = [
      item({ keywordId: 'a', volume: 80, difficulty: 8, opportunity: 60 }),
    ];
    expect(bucketOf(items, 'a')).toBe('aspirational');
  });

  it('assigns the top five remaining by opportunity to primary', () => {
    const items = Array.from({ length: 7 }, (_, i) =>
      item({
        keywordId: `k${i}`,
        text: 'two words',
        volume: 50,
        difficulty: 3,
        opportunity: 70 - i,
      }),
    );
    const classified = classifyBuckets(items);
    const primaries = classified.filter((i) => i.bucket === 'primary');
    expect(primaries).toHaveLength(5);
    expect(primaries.map((i) => i.keywordId)).toEqual([
      'k0',
      'k1',
      'k2',
      'k3',
      'k4',
    ]);
  });

  it('classifies long phrases or low volume as longtail once primary is filled', () => {
    const fillers = Array.from({ length: 5 }, (_, i) =>
      item({ keywordId: `p${i}`, text: 'top word', opportunity: 95 - i }),
    );
    const items = [
      ...fillers,
      item({
        keywordId: 'phrase',
        text: 'offline pixel dungeon crawler',
        opportunity: 40,
      }),
      item({ keywordId: 'low', text: 'niche', volume: 20, opportunity: 40 }),
    ];
    expect(bucketOf(items, 'phrase')).toBe('longtail');
    expect(bucketOf(items, 'low')).toBe('longtail');
  });

  it('leaves the rest as secondary', () => {
    const items = [
      item({ keywordId: 'sec', text: 'midword', volume: 55, difficulty: 3 }),
      ...Array.from({ length: 5 }, (_, i) =>
        item({
          keywordId: `p${i}`,
          text: 'top word',
          volume: 60,
          difficulty: 3,
          opportunity: 90 - i,
        }),
      ),
    ];
    expect(bucketOf(items, 'sec')).toBe('secondary');
  });

  it('returns a null bucket for unscored keywords', () => {
    const items = [item({ keywordId: 'u', volume: null, opportunity: null })];
    expect(bucketOf(items, 'u')).toBeNull();
  });
});
