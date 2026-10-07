import { Store } from '@prisma/client';
import { KEYWORD_NOTE_MAX_LENGTH, KeywordImportRow } from '@asobeast/shared';
import { classifyImportRows } from './keyword-import';

const appStore = { store: Store.APP_STORE, country: 'us' };
const play = { store: Store.GOOGLE_PLAY, country: 'us' };

const classify = (
  rows: KeywordImportRow[],
  context: { store: Store; country: string } = appStore,
) => classifyImportRows(rows, context);

describe('classifyImportRows', () => {
  it('turns a plain row into a candidate in the default market', () => {
    expect(classify([{ keyword: '  Habit   Tracker ' }])).toEqual([
      {
        kind: 'candidate',
        candidate: {
          index: 0,
          text: 'habit tracker',
          country: 'us',
          tags: [],
          note: null,
        },
      },
    ]);
  });

  it.each([null, '', '   '])(
    'uses the default market for the country %j',
    (country) => {
      const [row] = classify([{ keyword: 'habit', country }], {
        store: Store.APP_STORE,
        country: 'de',
      });

      expect(row).toMatchObject({
        kind: 'candidate',
        candidate: { country: 'de' },
      });
    },
  );

  it.each([
    ['ตัวจับเวลา', 'ตัวจับเวลา'],
    ['习惯追踪器', '习惯追踪器'],
    ['Zażółć Gęślą', 'zażółć gęślą'],
  ])('keeps the letters of %s', (keyword, text) => {
    expect(classify([{ keyword }])[0]).toMatchObject({
      kind: 'candidate',
      candidate: { text },
    });
  });

  it.each([
    ['', 'empty'],
    ['!!!', 'empty'],
    ['b'.repeat(101), 'tooLong'],
    ['one two three four five six', 'tooManyWords'],
  ])('refuses the keyword %j as %s', (keyword, reason) => {
    expect(classify([{ keyword }])[0]).toMatchObject({
      kind: 'invalid',
      index: 0,
      reason,
    });
  });

  it('lower cases a country and refuses codes that are not storefronts', () => {
    const rows = classify([
      { keyword: 'a1', country: 'US' },
      { keyword: 'a2', country: 'zz' },
      { keyword: 'a3', country: 'usa' },
      { keyword: 'a4', country: 'uk' },
    ]);

    expect(rows.map((row) => row.kind)).toEqual([
      'candidate',
      'invalid',
      'invalid',
      'invalid',
    ]);
    expect(rows[1]).toMatchObject({
      reason: 'unknownCountry',
      country: 'zz',
      message: 'zz is not an App Store storefront',
    });
  });

  it('judges a country by the store of the app', () => {
    expect(
      classify([{ keyword: 'tower', country: 'pw' }], play)[0],
    ).toMatchObject({
      kind: 'invalid',
      message: 'pw is not a Google Play location',
    });
    expect(classify([{ keyword: 'tower', country: 'pw' }])[0].kind).toBe(
      'candidate',
    );
  });

  it('marks a phrase that repeats an earlier row, whatever its case or punctuation', () => {
    const rows = classify([
      { keyword: 'Habit Tracker' },
      { keyword: 'habit-tracker' },
      { keyword: 'HABIT   TRACKER!' },
    ]);

    expect(rows.map((row) => row.kind)).toEqual([
      'candidate',
      'duplicate',
      'duplicate',
    ]);
    expect(rows[2]).toMatchObject({ index: 2, duplicateOf: 0 });
  });

  it('keeps the same phrase in two markets as two rows', () => {
    const rows = classify([
      { keyword: 'habit', country: 'us' },
      { keyword: 'habit', country: 'pl' },
    ]);

    expect(rows.map((row) => row.kind)).toEqual(['candidate', 'candidate']);
  });

  it('stores normalized tags and drops the ones that collapse together', () => {
    expect(
      classify([{ keyword: 'habit', tags: ['Core', ' core ', 'Brand'] }])[0],
    ).toMatchObject({ candidate: { tags: ['core', 'brand'] } });
  });

  it('accepts nine tags that collapse to eight and refuses nine distinct ones', () => {
    const collapsing = ['Core', 'core', 'a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const distinct = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];

    expect(classify([{ keyword: 'habit', tags: collapsing }])[0].kind).toBe(
      'candidate',
    );
    expect(classify([{ keyword: 'habit', tags: distinct }])[0]).toMatchObject({
      kind: 'invalid',
      reason: 'tooManyTags',
      message: 'A keyword takes at most 8 tags, this row has 9',
    });
  });

  it.each(['#hash', 'a'.repeat(25), '-lead'])(
    'refuses the tag %s and names it',
    (tag) => {
      expect(classify([{ keyword: 'habit', tags: [tag] }])[0]).toMatchObject({
        kind: 'invalid',
        reason: 'invalidTag',
      });
    },
  );

  it('trims a note, stores a blank one as none and refuses one that is too long', () => {
    expect(classify([{ keyword: 'a1', note: '  Q4 push ' }])[0]).toMatchObject({
      candidate: { note: 'Q4 push' },
    });
    expect(classify([{ keyword: 'a2', note: '  ' }])[0]).toMatchObject({
      candidate: { note: null },
    });
    expect(
      classify([
        { keyword: 'a3', note: 'x'.repeat(KEYWORD_NOTE_MAX_LENGTH + 1) },
      ])[0],
    ).toMatchObject({ kind: 'invalid', reason: 'noteTooLong' });
  });

  it('does not let a refused row claim its phrase for a later duplicate', () => {
    const rows = classify([
      { keyword: 'habit', tags: ['#bad'] },
      { keyword: 'habit' },
    ]);

    expect(rows.map((row) => row.kind)).toEqual(['invalid', 'candidate']);
  });
});
