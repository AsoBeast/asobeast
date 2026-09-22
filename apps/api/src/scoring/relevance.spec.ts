import { defaultRelevance, RankingEvidence } from './relevance';

const evidence = (
  position: number | null,
  checked = true,
): RankingEvidence => ({
  position,
  checked,
});

describe('defaultRelevance', () => {
  it('adds the overlap bonus when the keyword is fully in the snapshot', () => {
    expect(
      defaultRelevance('TITLE', 'habit tracker', 'daily habit tracker'),
    ).toBe(100);
  });

  it('subtracts the bonus when there is zero overlap', () => {
    expect(defaultRelevance('COMPETITOR', 'sudoku', 'habit tracker')).toBe(40);
  });

  it('keeps the base for partial overlap', () => {
    expect(
      defaultRelevance('SUGGESTED', 'habit journal', 'habit tracker'),
    ).toBe(60);
  });

  it('keeps the base for a keyword without a word', () => {
    expect(defaultRelevance('MANUAL', '!!', 'habit tracker')).toBe(80);
  });
});

describe('ranking evidence', () => {
  it('trusts the store when the app already ranks in the top fifty', () => {
    expect(
      defaultRelevance('COMPETITOR', 'geo quiz', 'weather radar', evidence(50)),
    ).toBe(70);
    expect(
      defaultRelevance('COMPETITOR', 'geo quiz', 'weather radar', evidence(51)),
    ).toBe(40);
  });

  it('never lowers a keyword that already scores above the floor', () => {
    expect(
      defaultRelevance('TITLE', 'geo quiz', 'geo quiz world', evidence(3)),
    ).toBe(100);
  });

  it.each(['DESCRIPTION', 'SUGGESTED', 'COMPETITOR'] as const)(
    'takes ten from a %s keyword that was checked and not found',
    (source) => {
      const unchecked = defaultRelevance(
        source,
        'geo quiz',
        'geo puzzle',
        evidence(null, false),
      );
      expect(
        defaultRelevance(source, 'geo quiz', 'geo puzzle', evidence(null)),
      ).toBe(unchecked - 10);
    },
  );

  it.each(['TITLE', 'SUBTITLE', 'KEYWORD_FIELD', 'MANUAL'] as const)(
    'leaves a %s keyword alone when it does not rank',
    (source) => {
      expect(
        defaultRelevance(source, 'geo quiz', 'geo puzzle', evidence(null)),
      ).toBe(defaultRelevance(source, 'geo quiz', 'geo puzzle'));
    },
  );

  it('stays between 1 and 100', () => {
    expect(
      defaultRelevance('COMPETITOR', 'zzz', 'geo', evidence(null)),
    ).toBeGreaterThanOrEqual(1);
  });
});
