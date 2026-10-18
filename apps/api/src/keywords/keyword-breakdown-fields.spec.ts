import type {
  KeywordBreakdownField,
  KeywordBreakdownListing,
  MetadataField,
} from '@asobeast/shared';
import {
  bestPlacement,
  judgeField,
  judgeListing,
  keywordWords,
  markWords,
  placementOf,
  wordMatches,
} from './keyword-breakdown-fields';
import { coversKeyword } from './keyword-coverage';

const judge = (field: MetadataField, value: string, keyword: string) =>
  judgeField({ field, value }, keyword, keywordWords(keyword), true);

const joined = (value: string, words: string[]) =>
  markWords(value, words)
    .map((segment) => segment.text)
    .join('');

const listing = (
  keyword: string,
  surfaces: Array<[MetadataField, string]>,
  localization: string | null = 'en-US',
): KeywordBreakdownListing =>
  judgeListing(
    localization,
    localization === null ? null : 'default',
    surfaces.map(([field, value]) => judge(field, value, keyword)),
  );

describe('keywordWords', () => {
  it('answers the distinct words in order', () => {
    expect(keywordWords('Habit  tracker habit')).toEqual(['habit', 'tracker']);
  });

  it('keeps a spaceless phrase whole', () => {
    expect(keywordWords('習慣トラッカー')).toEqual(['習慣トラッカー']);
  });

  it('answers nothing for punctuation', () => {
    expect(keywordWords('—')).toEqual([]);
  });
});

describe('judgeField', () => {
  const cases: Array<[string, string]> = [
    ['Habit Tracker: Daily Goals', 'habit tracker'],
    ['Tracker for every Habit', 'habit tracker'],
    ['Daily Habit', 'habit tracker'],
    ['Habits', 'habit'],
  ];

  it('finds the whole phrase in a title', () => {
    const field = judge('title', 'Habit Tracker: Daily Goals', 'habit tracker');
    expect(field.phrase).toBe(true);
    expect(field.words).toEqual([
      { word: 'habit', match: 'exact' },
      { word: 'tracker', match: 'exact' },
    ]);
  });

  it('finds every word but not the phrase', () => {
    const field = judge('title', 'Tracker for every Habit', 'habit tracker');
    expect(field.phrase).toBe(false);
    expect(field.words.map((word) => word.match)).toEqual(['exact', 'exact']);
  });

  it('finds some words', () => {
    expect(judge('title', 'Daily Habit', 'habit tracker').words).toEqual([
      { word: 'habit', match: 'exact' },
      { word: 'tracker', match: 'none' },
    ]);
  });

  it('agrees with coverage on whole words', () => {
    expect(judge('title', 'Habits', 'habit').words[0].match).toBe('none');
    for (const [value, keyword] of cases) {
      expect(judge('title', value, keyword).phrase).toBe(
        coversKeyword(value, keyword),
      );
    }
  });

  it('reports an accent folded match without counting it', () => {
    const field = judge('title', 'Visites guidées', 'visites guidees');
    expect(field.phrase).toBe(false);
    expect(field.words).toEqual([
      { word: 'visites', match: 'exact' },
      { word: 'guidees', match: 'folded' },
    ]);
  });

  it('folds only Latin and Greek accents', () => {
    expect(judge('title', 'สวัสดี', 'สวัสดิ').words[0].match).toBe('none');
  });

  it('reads a spaceless keyword inside a run', () => {
    const field = judge('subtitle', '毎日の習慣トラッカー', '習慣トラッカー');
    expect(field.phrase).toBe(true);
    expect(field.words).toEqual([{ word: '習慣トラッカー', match: 'exact' }]);
  });

  it('reads a Korean particle form', () => {
    expect(judge('title', '습관을 기록', '습관').words[0].match).toBe('exact');
  });

  it('reads a keyword field as one text', () => {
    const field = judge(
      'keywordField',
      'habit, tracker, streak',
      'habit tracker',
    );
    expect(field.phrase).toBe(true);
  });

  it('an empty field matches nothing', () => {
    const field = judge('subtitle', '', 'habit tracker');
    expect(field.phrase).toBe(false);
    expect(field.words.map((word) => word.match)).toEqual(['none', 'none']);
    expect(field.segments).toEqual([]);
  });

  it('builds no segments when asked not to', () => {
    expect(
      judgeField(
        { field: 'description', value: 'Habit tracker' },
        'habit tracker',
        ['habit', 'tracker'],
        false,
      ).segments,
    ).toBeNull();
  });
});

describe('markWords', () => {
  it('marks each matching word and keeps the text', () => {
    const value = 'Habit Tracker: Daily Goals';
    expect(markWords(value, ['habit', 'tracker'])).toEqual([
      { text: 'Habit', match: 'exact' },
      { text: ' ', match: 'none' },
      { text: 'Tracker', match: 'exact' },
      { text: ': Daily Goals', match: 'none' },
    ]);
    expect(joined(value, ['habit', 'tracker'])).toBe(value);
  });

  it('marks a folded word as folded', () => {
    expect(markWords('Visites guidées', ['guidees'])).toEqual([
      { text: 'Visites ', match: 'none' },
      { text: 'guidées', match: 'folded' },
    ]);
  });

  it('marks a spaceless word inside a run', () => {
    expect(markWords('毎日の習慣トラッカー', ['習慣トラッカー'])).toEqual([
      { text: '毎日の', match: 'none' },
      { text: '習慣トラッカー', match: 'exact' },
    ]);
  });

  it('marks a Latin word inside a mixed run', () => {
    expect(markWords('AI日記', ['ai'])).toEqual([
      { text: 'AI', match: 'exact' },
      { text: '日記', match: 'none' },
    ]);
  });

  it('keeps a right to left text in order', () => {
    const value = 'تطبيق تتبع العادات';
    const segments = markWords(value, ['العادات']);
    expect(segments).toContainEqual({ text: 'العادات', match: 'exact' });
    expect(joined(value, ['العادات'])).toBe(value);
  });

  it('never splits a surrogate pair', () => {
    const value = 'Focus 🍅 timer';
    expect(markWords(value, ['timer'])).toEqual([
      { text: 'Focus 🍅 ', match: 'none' },
      { text: 'timer', match: 'exact' },
    ]);
  });

  it('joins adjacent unmatched runs', () => {
    const segments = markWords('one two three four', ['three']);
    for (let index = 1; index < segments.length; index += 1) {
      expect(segments[index].match).not.toBe(segments[index - 1].match);
    }
  });

  it('normalizes to NFC first', () => {
    const decomposed = 'Café timer';
    expect(markWords(decomposed, ['café'])).toEqual([
      { text: 'Café', match: 'exact' },
      { text: ' timer', match: 'none' },
    ]);
  });

  it('answers nothing for an empty text', () => {
    expect(markWords('', ['habit'])).toEqual([]);
  });
});

describe('placementOf and judgeListing', () => {
  it('names the strongest field holding the phrase', () => {
    expect(
      listing('habit tracker', [
        ['title', 'Daily Habit'],
        ['subtitle', 'The habit tracker'],
      ]).placement,
    ).toBe('subtitle');
  });

  it('prefers the title', () => {
    expect(
      listing('habit tracker', [
        ['title', 'Habit Tracker'],
        ['subtitle', 'The habit tracker'],
      ]).placement,
    ).toBe('title');
  });

  it('answers split when the words sit in different fields of one localization', () => {
    expect(
      listing('habit tracker', [
        ['title', 'Habit'],
        ['subtitle', 'Tracker'],
      ]).placement,
    ).toBe('split');
  });

  it('answers partial for some words and none for nothing', () => {
    expect(
      listing('habit tracker', [
        ['title', 'Habit'],
        ['subtitle', 'Daily'],
      ]).placement,
    ).toBe('partial');
    expect(
      listing('habit tracker', [
        ['title', 'Focus'],
        ['subtitle', 'Daily'],
      ]).placement,
    ).toBe('none');
  });

  it('does not count folded words toward split', () => {
    expect(
      listing('visites guidees', [
        ['title', 'Visites'],
        ['subtitle', 'guidées'],
      ]).placement,
    ).toBe('partial');
  });

  it('orders Google Play fields, and a phrase in the description outranks split', () => {
    const play = (fields: Array<[MetadataField, string]>) =>
      listing('habit tracker', fields, null).placement;
    expect(
      play([
        ['title', 'Habit'],
        ['shortDescription', 'Tracker'],
        ['description', 'The best habit tracker'],
      ]),
    ).toBe('description');
    expect(
      play([
        ['title', 'Daily'],
        ['shortDescription', 'Habit tracker for you'],
        ['description', 'Habit tracker'],
      ]),
    ).toBe('shortDescription');
  });

  it('answers none for a keyword without words', () => {
    expect(placementOf([judge('title', 'Anything', '—')])).toBe('none');
  });
});

describe('bestPlacement', () => {
  it('answers the strongest of several listings and keeps the first on a tie', () => {
    const first = listing('habit tracker', [['subtitle', 'Habit tracker']]);
    const second = listing(
      'habit tracker',
      [['title', 'Habit tracker']],
      'es-MX',
    );
    expect(bestPlacement([first, second])).toBe('title');
    expect(bestPlacement([first, first])).toBe('subtitle');
    expect(bestPlacement([])).toBe('none');
  });
});

describe('wordMatches', () => {
  it('answers the best match of each word across every listing', () => {
    const words = ['visites', 'guidees', 'paris'];
    const english = listing('visites guidees paris', [
      ['title', 'Visites guidées'],
    ]);
    const spanish = listing(
      'visites guidees paris',
      [['title', 'Paris guidees']],
      'es-MX',
    );
    const matches = wordMatches([english, spanish], words);
    expect(matches.get('visites')).toBe('exact');
    expect(matches.get('guidees')).toBe('exact');
    expect(matches.get('paris')).toBe('exact');
    expect(wordMatches([english], words).get('guidees')).toBe('folded');
    expect(wordMatches([english], words).get('paris')).toBe('none');
  });

  it('answers none for every word with no listing', () => {
    const fields: KeywordBreakdownField[] = [];
    expect(
      wordMatches([judgeListing(null, null, fields)], ['habit']).get('habit'),
    ).toBe('none');
  });
});
