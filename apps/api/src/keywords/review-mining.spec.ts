import { mineReviewPhrases } from './review-mining';

describe('mineReviewPhrases', () => {
  it('ranks phrases by the number of distinct reviews containing them', () => {
    const suggestions = mineReviewPhrases(
      [
        { title: null, text: 'dark mode is great' },
        { title: null, text: 'please add dark mode' },
        { title: null, text: 'love the widget' },
      ],
      new Set(),
    );

    const darkMode = suggestions.find((item) => item.text === 'dark mode');
    const widget = suggestions.find((item) => item.text === 'widget');
    expect(darkMode?.usedByCount).toBe(2);
    expect(darkMode?.strategy).toBe('reviews');
    expect(widget?.usedByCount).toBe(1);
    const counts = suggestions.map((item) => item.usedByCount ?? 0);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });

  it('counts a phrase once per review even if it repeats', () => {
    const suggestions = mineReviewPhrases(
      [{ title: 'widget widget', text: 'widget everywhere' }],
      new Set(),
    );

    expect(
      suggestions.find((item) => item.text === 'widget')?.usedByCount,
    ).toBe(1);
  });

  it('normalizes casing so variants collapse', () => {
    const suggestions = mineReviewPhrases(
      [
        { title: null, text: 'Dark Mode rocks' },
        { title: null, text: 'dark mode please' },
      ],
      new Set(),
    );

    expect(
      suggestions.find((item) => item.text === 'dark mode')?.usedByCount,
    ).toBe(2);
  });

  it('excludes phrases already tracked by the app', () => {
    const suggestions = mineReviewPhrases(
      [{ title: null, text: 'dark mode widget' }],
      new Set(['dark mode']),
    );

    expect(suggestions.map((item) => item.text)).not.toContain('dark mode');
    expect(suggestions.map((item) => item.text)).toContain('widget');
  });

  it('drops stopword-only and sub-3-character phrases', () => {
    const suggestions = mineReviewPhrases(
      [{ title: null, text: 'it is on' }],
      new Set(),
    );

    expect(suggestions).toEqual([]);
  });
});
