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

  const startingOrEndingWith = (texts: string[], words: readonly string[]) =>
    texts.filter((text) => {
      const tokens = text.split(' ');
      return (
        words.includes(tokens[0]) || words.includes(tokens[tokens.length - 1])
      );
    });

  it.each([
    {
      language: 'fr',
      reviews: [
        'Je scanne mes courses depuis des mois pour mon budget',
        'Je suis contente, avant je ne savais jamais ce que je mangeais',
        'Appli pratique sans publicité',
      ],
      skipped: ['depuis', 'avant', 'suis', 'mes', 'mon', 'ma', 'sans'],
      kept: ['scanne mes courses', 'pratique sans publicité', 'courses'],
    },
    {
      language: 'de',
      reviews: ['Der Artikel hat Fehler', 'Die Lieferung war schnell'],
      skipped: ['hat', 'war'],
      kept: ['artikel hat fehler', 'lieferung war schnell'],
    },
    {
      language: 'pl',
      reviews: ['Zawsze coś nie działa, zamiast przycisku jest błąd'],
      skipped: ['zawsze', 'coś', 'zamiast'],
      kept: ['działa', 'przycisku jest błąd'],
    },
  ])(
    'never starts or ends a $language review idea with $skipped',
    ({ language, reviews, skipped, kept }) => {
      const texts = textsOf(reviews, [language]);

      expect(startingOrEndingWith(texts, skipped)).toEqual([]);
      expect(texts).toEqual(expect.arrayContaining(kept));
    },
  );

  it('never starts or ends a review idea with now, every, much, ever or also', () => {
    const texts = textsOf([
      'Works fine now, but also crashes every time',
      'Much slower than ever',
    ]);

    expect(
      startingOrEndingWith(texts, ['now', 'every', 'much', 'ever', 'also']),
    ).toEqual([]);
    expect(texts).toEqual(
      expect.arrayContaining(['works fine', 'crashes every time', 'slower']),
    );
  });

  it('leaves the words the issue keeps out of the lists to the reviewer', () => {
    expect(textsOf(['Elle fait bien le travail'], ['fr'])).toEqual(
      expect.arrayContaining(['elle', 'fait', 'bien']),
    );
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
