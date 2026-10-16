import { mineReviewPhrases, reviewPhrases } from './review-mining';

describe('mineReviewPhrases', () => {
  it('ranks phrases by the number of distinct reviews containing them', () => {
    const suggestions = mineReviewPhrases(
      [
        { title: null, text: 'dark mode is great' },
        { title: null, text: 'please add dark mode' },
        { title: null, text: 'love the widget' },
      ],
      new Set(),
      [],
    );

    const darkMode = suggestions.find((item) => item.text === 'dark mode');
    const widget = suggestions.find((item) => item.text === 'widget');
    expect(darkMode?.usedByCount).toBe(2);
    expect(darkMode?.strategy).toBe('reviews');
    expect(widget?.usedByCount).toBe(1);
    const counts = suggestions.map((item) => item.usedByCount ?? 0);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });

  it('mines nothing from a rating only review and still counts the others', () => {
    const suggestions = mineReviewPhrases(
      [
        { title: null, text: '' },
        { title: null, text: 'dark mode please' },
      ],
      new Set(),
      [],
    );

    expect(suggestions.map((item) => item.text)).toContain('dark mode');
    expect(suggestions.every((item) => item.usedByCount === 1)).toBe(true);
  });

  it('counts a phrase once per review even if it repeats', () => {
    const suggestions = mineReviewPhrases(
      [{ title: 'widget widget', text: 'widget everywhere' }],
      new Set(),
      [],
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
      [],
    );

    expect(
      suggestions.find((item) => item.text === 'dark mode')?.usedByCount,
    ).toBe(2);
  });

  it('excludes phrases already tracked by the app', () => {
    const suggestions = mineReviewPhrases(
      [{ title: null, text: 'dark mode widget' }],
      new Set(['dark mode']),
      [],
    );

    expect(suggestions.map((item) => item.text)).not.toContain('dark mode');
    expect(suggestions.map((item) => item.text)).toContain('widget');
  });

  it('drops stopword-only and sub-3-character phrases', () => {
    const suggestions = mineReviewPhrases(
      [{ title: null, text: 'it is on' }],
      new Set(),
      [],
    );

    expect(suggestions).toEqual([]);
  });

  const textsOf = (texts: string[], languages: readonly string[] = []) =>
    mineReviewPhrases(
      texts.map((text) => ({ title: null, text })),
      new Set(),
      languages,
    ).map((item) => item.text);

  it.each([
    ["It's fast and I've used it daily, I'm happy", ['it s', 'i ve', 'i m']],
    ["Don't trust the driver, it doesn't work", ['don', 'don t', 'doesn']],
  ])('reads a contraction as the word it contracts in %p', (text, noise) => {
    const texts = textsOf([text]);

    for (const fragment of noise) expect(texts).not.toContain(fragment);
  });

  it('never starts or ends a phrase with a function word', () => {
    const texts = textsOf([
      'Bear is easy to use and I love the driver, just works',
    ]);

    expect(texts).toEqual(
      expect.arrayContaining(['bear', 'easy', 'love', 'driver', 'works']),
    );
    for (const noise of ['bear is', 'to use', 'i love', 'the driver', 'just']) {
      expect(texts).not.toContain(noise);
    }
  });

  it('keeps a function word inside a phrase', () => {
    expect(textsOf(['crashes on launch'])).toContain('crashes on launch');
  });

  it('drops the function words of the market language', () => {
    const texts = textsOf(['die Synchronisation mit der Uhr'], ['de']);

    expect(texts).toEqual(expect.arrayContaining(['synchronisation', 'uhr']));
    expect(texts).not.toContain('die synchronisation');
    expect(texts).not.toContain('mit');
  });

  it('reads a version number as a quantity rather than words', () => {
    const texts = textsOf(['crashes in 0.78.8 and 0.1']);

    expect(texts).toEqual(['crashes']);
  });

  it('never joins the title to the text', () => {
    const suggestions = mineReviewPhrases(
      [{ title: 'Great sync', text: 'widget broke' }],
      new Set(),
      [],
    );

    expect(suggestions.map((item) => item.text)).not.toContain('sync widget');
  });
});

describe('reviewPhrases', () => {
  const REVIEW = { title: null, text: 'I encountered a fatal error today' };

  it('reads up to three words unless asked for more', () => {
    expect(reviewPhrases(REVIEW, [])).not.toContain(
      'encountered a fatal error',
    );
    expect(reviewPhrases(REVIEW, [], { maxWords: 4 })).toContain(
      'encountered a fatal error',
    );
    expect(reviewPhrases(REVIEW, [], { maxWords: 4 })).not.toContain(
      'encountered a fatal error today',
    );
  });

  it('keeps an ignored word inside a phrase and never at its edges', () => {
    const phrases = reviewPhrases(REVIEW, [], {
      maxWords: 4,
      ignored: new Set(['fatal']),
    });

    expect(phrases).toContain('encountered a fatal error');
    expect(phrases).not.toContain('fatal');
    expect(phrases).not.toContain('fatal error');
  });
});
