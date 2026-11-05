import {
  BRAND_NAME_MAX_WORDS,
  brandNameOf,
  contentWords,
  developerNameOf,
} from './brand-words';

const words = (name: ReadonlySet<string> | null) =>
  name === null ? null : [...name];

describe('brandNameOf', () => {
  it.each([
    ['Forest: Stay Focused', ['forest']],
    ['Todoist - To-Do List & Calendar', ['todoist']],
    ['Notion', ['notion']],
    ['GeoGuessr', ['geoguessr']],
    ['Habit Tracker', null],
    ['Habit Tracker.', null],
    ['Café Finder | Maps', ['cafe', 'finder']],
    ['Things 3: Task Manager', ['things', '3']],
    ['The Weather Channel: Radar', ['weather', 'channel']],
    ['Plan Your Day Better Today: Planner', null],
    ['Plan Your Day: Planner', ['plan', 'day']],
    ['微信', ['微信']],
    ['', null],
    ['The', null],
    [': x', null],
  ])('reads %j as %j', (title, expected) => {
    expect(words(brandNameOf(title))).toEqual(expected);
  });

  it(`accepts a lead of ${BRAND_NAME_MAX_WORDS} words and refuses one more`, () => {
    expect(words(brandNameOf('Alpha Beta Gamma: x'))).toEqual([
      'alpha',
      'beta',
      'gamma',
    ]);
    expect(brandNameOf('Alpha Beta Gamma Delta: x')).toBeNull();
  });
});

describe('developerNameOf', () => {
  it.each([
    ['Seekrtech Inc.', ['seekrtech']],
    ['Notion Labs, Inc.', ['notion']],
    ['Apps Inc', null],
    ['John Smith', ['john', 'smith']],
    [null, null],
  ])('reads %j as %j', (developer, expected) => {
    expect(words(developerNameOf(developer))).toEqual(expected);
  });
});

describe('contentWords', () => {
  it('drops stopwords and folds accents', () => {
    expect(contentWords('The best café app')).toEqual(['cafe']);
  });

  it('answers nothing for empty text', () => {
    expect(contentWords('')).toEqual([]);
  });
});
