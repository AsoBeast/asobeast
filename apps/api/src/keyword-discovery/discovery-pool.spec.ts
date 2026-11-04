import { KeywordSource } from '@prisma/client';
import { DISCOVERY_POOL_LIMIT, DiscoverySource } from '@asobeast/shared';
import { buildPool, keywordSourceOf, PoolCandidate } from './discovery-pool';

const candidate = (
  text: string,
  overrides: Partial<PoolCandidate> = {},
): PoolCandidate => ({
  text,
  source: 'title',
  relevance: 90,
  traffic: null,
  ...overrides,
});

const nothing: ReadonlySet<string> = new Set();

describe('buildPool', () => {
  it('keeps the source with the higher relevance for a repeated phrase', () => {
    const pool = buildPool(
      [
        candidate('habit tracker', { source: 'reviews', relevance: 60 }),
        candidate('habit tracker', { source: 'title', relevance: 90 }),
      ],
      { excluded: nothing },
    );

    expect(pool).toEqual([candidate('habit tracker')]);
  });

  it('breaks an equal relevance by the order of the sources', () => {
    const pool = buildPool(
      [
        candidate('habit tracker', { source: 'portfolio', relevance: 60 }),
        candidate('habit tracker', { source: 'reviews', relevance: 60 }),
      ],
      { excluded: nothing },
    );

    expect(pool.map(({ source }) => source)).toEqual(['reviews']);
  });

  it('keeps the larger traffic of a folded phrase', () => {
    const pool = buildPool(
      [
        candidate('habit tracker', { traffic: 4 }),
        candidate('habit tracker', { source: 'portfolio', relevance: 60 }),
        candidate('habit tracker', {
          source: 'popularity',
          relevance: 60,
          traffic: 6,
        }),
      ],
      { excluded: nothing },
    );

    expect(pool).toEqual([candidate('habit tracker', { traffic: 6 })]);
  });

  it('folds phrases that normalize to the same text', () => {
    const pool = buildPool(
      [candidate('Habit  Tracker'), candidate('habit tracker')],
      { excluded: nothing },
    );

    expect(pool.map(({ text }) => text)).toEqual(['habit tracker']);
  });

  it('drops a tracked or dismissed phrase after normalization', () => {
    const pool = buildPool(
      [candidate('Habit Tracker'), candidate('mood journal')],
      { excluded: new Set(['habit tracker', 'Mood  Journal ']) },
    );

    expect(pool).toEqual([]);
  });

  it.each([
    ['too long', 'a'.repeat(101)],
    ['too many words', 'one two three four five six'],
    ['empty', '  '],
  ])('drops a phrase that is %s', (_reason, text) => {
    expect(buildPool([candidate(text)], { excluded: nothing })).toEqual([]);
  });

  it('orders by relevance, then traffic with unknown last, then text', () => {
    const pool = buildPool(
      [
        candidate('zeta', { relevance: 60, traffic: null }),
        candidate('beta', { relevance: 60, traffic: 2 }),
        candidate('alpha', { relevance: 60, traffic: null }),
        candidate('gamma', { relevance: 60, traffic: 7 }),
        candidate('delta', { relevance: 90, traffic: null }),
      ],
      { excluded: nothing },
    );

    expect(pool.map(({ text }) => text)).toEqual([
      'delta',
      'gamma',
      'beta',
      'alpha',
      'zeta',
    ]);
  });

  it('cuts the pool to its default limit or the one given', () => {
    const many = Array.from({ length: DISCOVERY_POOL_LIMIT + 5 }, (_, index) =>
      candidate(`phrase ${String(index).padStart(3, '0')}`),
    );

    expect(buildPool(many, { excluded: nothing })).toHaveLength(
      DISCOVERY_POOL_LIMIT,
    );
    expect(
      buildPool(many, { excluded: nothing, limit: 3 }).map(({ text }) => text),
    ).toEqual(['phrase 000', 'phrase 001', 'phrase 002']);
  });
});

describe('keywordSourceOf', () => {
  it('tracks each discovery source as the keyword source it stands for', () => {
    expect(keywordSourceOf).toEqual({
      title: KeywordSource.TITLE,
      subtitle: KeywordSource.SUBTITLE,
      description: KeywordSource.DESCRIPTION,
      competitors: KeywordSource.COMPETITOR,
      reviews: KeywordSource.SUGGESTED,
      popularity: KeywordSource.SUGGESTED,
      portfolio: KeywordSource.SUGGESTED,
    } satisfies Record<DiscoverySource, KeywordSource>);
  });
});
