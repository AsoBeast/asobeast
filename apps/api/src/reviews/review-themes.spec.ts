import {
  REVIEW_THEMES_LIMIT,
  reviewThemes,
  themeExclusions,
  ThemeReview,
} from './review-themes';

const OPTIONS = {
  languages: [],
  negativeScoreMax: 2,
  excluded: themeExclusions('Focus Timer'),
};

const review = (text: string, score = 1): ThemeReview => ({
  title: null,
  text,
  score,
});

describe('reviewThemes', () => {
  it('counts each phrase once per review and keeps those repeated in two', () => {
    const themes = reviewThemes(
      [
        review('Sync fails. Sync fails again.'),
        review('Sync fails on my tablet'),
        review('Beautiful colors', 5),
      ],
      OPTIONS,
    );

    expect(themes).toEqual([
      { phrase: 'sync fails', mentions: 2, negative: 2 },
    ]);
  });

  it('ranks the phrases of low rated reviews ahead of praise mentioned more often', () => {
    const themes = reviewThemes(
      [
        review('Dark mode please', 5),
        review('Dark mode is great', 5),
        review('Dark mode rocks', 4),
        review('Widget crashes', 1),
        review('Widget crashes daily', 2),
      ],
      OPTIONS,
    );

    expect(themes.map((theme) => theme.phrase)).toEqual([
      'widget crashes',
      'dark mode',
    ]);
    expect(themes[1]).toEqual({
      phrase: 'dark mode',
      mentions: 3,
      negative: 0,
    });
  });

  it('keeps a shorter phrase only when it is mentioned beyond the longer one', () => {
    const themes = reviewThemes(
      [
        review('Battery drain overnight'),
        review('Battery drain overnight again'),
        review('Battery hungry'),
      ],
      OPTIONS,
    );

    expect(themes.map((theme) => theme.phrase)).toEqual([
      'battery',
      'battery drain overnight',
    ]);
  });

  it('leaves out the app name and generic words', () => {
    const themes = reviewThemes(
      [review('Focus timer app broke'), review('Focus timer app broke')],
      OPTIONS,
    );

    expect(themes.map((theme) => theme.phrase)).not.toEqual(
      expect.arrayContaining(['app', 'focus', 'timer', 'focus timer']),
    );
    expect(themes.map((theme) => theme.phrase)).toContain('timer app broke');
  });

  it(`answers at most ${REVIEW_THEMES_LIMIT} themes`, () => {
    const words = Array.from({ length: 12 }, (_, index) => `word${index}x`);
    const reviews = [review(words.join('. ')), review(words.join('. '))];

    expect(reviewThemes(reviews, OPTIONS)).toHaveLength(REVIEW_THEMES_LIMIT);
  });

  it('answers nothing for no reviews', () => {
    expect(reviewThemes([], OPTIONS)).toEqual([]);
  });
});
