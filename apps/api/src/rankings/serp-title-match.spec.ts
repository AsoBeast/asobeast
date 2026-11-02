import { titleJudge, titleMatchOf } from './serp-title-match';

describe('titleJudge', () => {
  it.each([
    ['Focus Timer Pro', 'focus timer', 'phrase'],
    ['Timer for Focus', 'focus timer', 'words'],
    ['Focus Keeper', 'focus timer', 'partial'],
    ['Pomodoro', 'focus timer', 'none'],
    ['Café Finder', 'cafe finder', 'partial'],
    ['専注タイマー', 'タイマー', 'phrase'],
  ] as const)('judges %j against %j as %s', (title, keyword, expected) => {
    expect(titleJudge(keyword)(title).titleMatch).toBe(expected);
  });

  it('answers no match and no segments for an empty title', () => {
    expect(titleJudge('focus')('')).toEqual({
      titleMatch: 'none',
      titleSegments: [],
    });
  });

  it('splits the title into segments that join back to its NFC form', () => {
    const title = 'Café Timer';
    const { titleSegments } = titleJudge('cafe timer')(title);

    expect(titleSegments.map((segment) => segment.text).join('')).toBe(
      title.normalize('NFC'),
    );
  });

  it('marks an exact run and a folded run', () => {
    expect(titleJudge('cafe timer')('Café Timer').titleSegments).toEqual([
      { text: 'Café', match: 'folded' },
      { text: ' ', match: 'none' },
      { text: 'Timer', match: 'exact' },
    ]);
  });
});

describe('titleMatchOf', () => {
  it('answers words only when every word matched exactly', () => {
    expect(titleMatchOf(false, ['exact', 'exact'])).toBe('words');
    expect(titleMatchOf(false, ['exact', 'folded'])).toBe('partial');
  });

  it('never counts a folded match', () => {
    expect(titleMatchOf(false, ['folded'])).toBe('none');
  });

  it('answers none without any word', () => {
    expect(titleMatchOf(false, [])).toBe('none');
  });

  it('answers phrase whenever the phrase matched', () => {
    expect(titleMatchOf(true, ['exact'])).toBe('phrase');
  });
});
