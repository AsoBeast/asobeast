import {
  newestFirst,
  REVIEW_THEME_LIMITS,
  reviewThemes,
  themeIgnoredWords,
  ThemeReview,
} from './review-themes';

const OPTIONS = {
  languages: [],
  negativeScoreMax: 2,
  ignored: themeIgnoredWords('Focus Timer'),
};

let nextId = 0;

const review = (text: string, score: number): ThemeReview => ({
  id: `review-${(nextId += 1)}`,
  title: null,
  text,
  score,
});

const times = (count: number, text: string, score: number) =>
  Array.from({ length: count }, () => review(text, score));

const phrasesOf = (themes: { phrase: string }[]) =>
  themes.map((theme) => theme.phrase);

const PRAISED = times(14, 'Dark mode', 5);

describe('reviewThemes', () => {
  const complaintsOf = (reviews: ThemeReview[], languages: string[]) =>
    phrasesOf(
      reviewThemes(reviews, reviews, { ...OPTIONS, languages }).filter(
        (theme) => theme.kind === 'complaint',
      ),
    );

  it('never names a theme that starts or ends with a function word of the storefront language', () => {
    const reviews = [
      ...times(6, 'Coś nie działa zamiast aktualizacji', 1),
      ...PRAISED,
    ];

    expect(complaintsOf(reviews, ['pl'])).toEqual([
      'działa zamiast aktualizacji',
    ]);
  });

  it('never ends a theme with now', () => {
    const reviews = [...times(6, 'Crashes now', 1), ...PRAISED];

    expect(complaintsOf(reviews, [])).toEqual(['crashes']);
  });

  it('names a phrase of low rated reviews a complaint and one of high rated reviews praise', () => {
    const reviews = [
      ...times(6, 'Sync fails', 1),
      ...PRAISED,
      ...times(2, 'Battery drain', 1),
      ...times(4, 'Battery drain', 5),
    ];

    expect(reviewThemes(reviews, reviews, OPTIONS)).toEqual([
      { phrase: 'sync fails', kind: 'complaint', mentions: 6, negative: 6 },
      { phrase: 'dark mode', kind: 'praise', mentions: 14, negative: 0 },
    ]);
  });

  it('judges a phrase against every review of the period and counts the reviews shown', () => {
    const negative = times(6, 'Sync fails', 1);
    const baseline = [...negative, ...PRAISED];

    expect(reviewThemes(baseline, negative, OPTIONS)).toEqual([
      { phrase: 'sync fails', kind: 'complaint', mentions: 6, negative: 6 },
    ]);
    expect(reviewThemes(baseline, negative.slice(0, 1), OPTIONS)).toEqual([]);
  });

  it('keeps a shorter phrase only when it reaches beyond the longer one', () => {
    const reviews = [
      ...times(3, 'Battery drain overnight', 1),
      ...times(3, 'Battery hungry', 1),
      ...PRAISED,
    ];

    expect(
      phrasesOf(reviewThemes(reviews, reviews, OPTIONS)).filter((phrase) =>
        phrase.startsWith('battery'),
      ),
    ).toEqual(['battery', 'battery drain overnight', 'battery hungry']);
  });

  it('joins overlapping words into the one phrase that holds them', () => {
    const reviews = [
      ...times(2, 'I encountered a fatal error today', 1),
      ...PRAISED,
    ];

    expect(phrasesOf(reviewThemes(reviews, reviews, OPTIONS))).toContain(
      'encountered a fatal error',
    );
  });

  it('never starts or ends a phrase with the app name or a filler word', () => {
    const reviews = [
      ...times(4, 'Focus Timer keeps crashing every time', 1),
      ...PRAISED,
    ];

    expect(phrasesOf(reviewThemes(reviews, reviews, OPTIONS))).toEqual([
      'crashing',
      'dark mode',
    ]);
  });

  it("leaves out the function words of each review's own language", () => {
    const reviews = [
      ...times(4, 'La aplicación se cierra cuando abro el chat que uso', 1),
      ...PRAISED,
    ];
    const phrases = phrasesOf(reviewThemes(reviews, reviews, OPTIONS));

    for (const word of ['que', 'el', 'se', 'cuando']) {
      expect(phrases).not.toContain(word);
    }
  });

  it('leaves out the function words of two languages a short review ties between', () => {
    const reviews = [
      ...times(4, 'La aplicación se cierra sola. Que mal servicio.', 1),
      ...PRAISED,
    ];

    expect(complaintsOf(reviews, [])).toEqual([
      'aplicación se cierra sola',
      'mal servicio',
    ]);
  });

  it('leaves out the spanish function words of a real short review the guess cannot place', () => {
    const reviews = [
      ...times(4, 'Basuea Como puede ser que no aregles sus bugs', 1),
      ...PRAISED,
    ];

    expect(complaintsOf(reviews, [])).toEqual([
      'aregles sus bugs',
      'basuea como puede',
    ]);
  });

  it('reads a short english review as before', () => {
    const reviews = [
      ...times(4, 'Great app but it crashes a lot', 1),
      ...PRAISED,
    ];

    expect(complaintsOf(reviews, [])).toEqual(['crashes']);
  });

  it('keeps a shorter phrase a filter leaves without its longer one', () => {
    const baseline = [
      ...times(10, 'Crashes on launch constantly', 1),
      ...times(3, 'Crashes', 2),
      ...times(20, 'Dark mode', 5),
    ];
    const twoStar = baseline.filter((review) => review.score === 2);

    expect(reviewThemes(baseline, twoStar, OPTIONS)).toEqual([
      { phrase: 'crashes', kind: 'complaint', mentions: 3, negative: 3 },
    ]);
  });

  it('still names complaints when most reviews of the period are low rated', () => {
    const reviews = [
      ...times(20, 'Crash after update', 1),
      ...times(8, 'Slow sync', 1),
      ...times(2, 'Dark mode', 5),
    ];
    const themes = reviewThemes(reviews, reviews, OPTIONS);

    expect(
      themes
        .filter((theme) => theme.kind === 'complaint')
        .map((theme) => theme.phrase),
    ).toEqual(['crash after update', 'slow sync']);
  });

  it('names praise when every review is high rated', () => {
    const praise = [...times(8, 'Dark mode', 5), ...times(3, 'Widgets', 4)];

    expect(reviewThemes(praise, praise, OPTIONS)).toEqual([
      { phrase: 'dark mode', kind: 'praise', mentions: 8, negative: 0 },
      { phrase: 'widgets', kind: 'praise', mentions: 3, negative: 0 },
    ]);
  });

  it('answers at most the limit of each kind', () => {
    const words = Array.from({ length: 9 }, (_, index) => `fault${index}x`);
    const reviews = [
      ...words.flatMap((word) => times(4, word, 1)),
      ...times(100, 'Dark mode', 5),
    ];
    const themes = reviewThemes(reviews, reviews, OPTIONS);

    expect(themes.filter((theme) => theme.kind === 'complaint')).toHaveLength(
      REVIEW_THEME_LIMITS.complaint,
    );
  });

  it('answers nothing for no reviews or a single one', () => {
    const one = times(1, 'Sync fails', 1);

    expect(reviewThemes([], [], OPTIONS)).toEqual([]);
    expect(reviewThemes(one, one, OPTIONS)).toEqual([]);
  });
});

describe('themeIgnoredWords', () => {
  it('ignores the words of the app name and works without one', () => {
    expect(themeIgnoredWords('Where Am I?').has('where')).toBe(true);
    expect(themeIgnoredWords(null).has('good')).toBe(true);
    expect(themeIgnoredWords(null).has('')).toBe(false);
  });
});

describe('newestFirst', () => {
  const dated = (id: string, iso: string | null) => ({
    id,
    reviewedAt: iso ? new Date(iso) : null,
  });

  it('merges pending and stored reviews newest first', () => {
    const stored = [
      dated('s2', '2026-11-02T10:00:00.000Z'),
      dated('s1', '2026-11-01T10:00:00.000Z'),
    ];
    const pending = [dated('p1', '2026-11-01T20:00:00.000Z')];

    expect(newestFirst(stored, pending, 10).map(({ id }) => id)).toEqual([
      's2',
      'p1',
      's1',
    ]);
  });

  it('keeps the stored order among reviews of the same instant and puts the pending one first', () => {
    const instant = '2026-11-02T10:00:00.000Z';
    const stored = [dated('s9', instant), dated('s3', instant)];

    expect(
      newestFirst(stored, [dated('p1', instant)], 10).map(({ id }) => id),
    ).toEqual(['p1', 's9', 's3']);
  });

  it('puts undated reviews last, pending or stored', () => {
    const stored = [dated('s1', null), dated('s2', '2026-11-01T10:00:00.000Z')];
    const pending = [dated('p1', null)];

    expect(newestFirst(stored, pending, 10).map(({ id }) => id)).toEqual([
      's2',
      'p1',
      's1',
    ]);
  });

  it('cuts the merged list to take', () => {
    const stored = [
      dated('s2', '2026-11-02T10:00:00.000Z'),
      dated('s1', '2026-11-01T10:00:00.000Z'),
    ];

    expect(
      newestFirst(stored, [dated('p1', '2026-11-03T10:00:00.000Z')], 2).map(
        ({ id }) => id,
      ),
    ).toEqual(['p1', 's2']);
  });

  it('returns the stored reviews unchanged when nothing is pending', () => {
    const stored = [
      { id: 'a', reviewedAt: undefined },
      { id: 'b', reviewedAt: undefined },
      { id: 'c', reviewedAt: undefined },
    ];

    const merged = newestFirst(stored, [], 10);

    expect(merged).toEqual(stored);
    merged.forEach((review, index) => expect(review).toBe(stored[index]));
  });
});
