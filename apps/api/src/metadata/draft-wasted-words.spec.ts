import { Store } from '@prisma/client';
import { draftWastedWords } from './draft-wasted-words';
import { Surface } from './localized-coverage';

const appStoreFields = (
  title: string,
  subtitle: string,
  keywordField = '',
): Surface[] => [
  { field: 'title', value: title },
  { field: 'subtitle', value: subtitle },
  { field: 'keywordField', value: keywordField },
];

describe('draftWastedWords', () => {
  it('reports a word the title and the keyword field both hold as repeated', () => {
    expect(
      draftWastedWords(
        Store.APP_STORE,
        appStoreFields('Habit Tracker', '', 'habit,goals'),
        ['habit tracker', 'daily goals'],
        [],
      ),
    ).toEqual([
      { word: 'habit', reason: 'repeated', fields: ['title', 'keywordField'] },
    ]);
  });

  it('reports a subtitle word no tracked keyword holds as unused', () => {
    expect(
      draftWastedWords(
        Store.APP_STORE,
        appStoreFields('Habit Tracker', 'Daily planner'),
        ['daily goals'],
        [],
      ),
    ).toEqual([{ word: 'planner', reason: 'unused', fields: ['subtitle'] }]);
  });

  it('counts a Japanese term inside a longer tracked run as used', () => {
    expect(
      draftWastedWords(
        Store.APP_STORE,
        appStoreFields('集中', 'タイマー', '習慣'),
        ['集中 タイマー アプリ'],
        [],
      ),
    ).toEqual([{ word: '習慣', reason: 'unused', fields: ['keywordField'] }]);
  });

  it('never reports a stopword or a brand word', () => {
    expect(
      draftWastedWords(
        Store.APP_STORE,
        appStoreFields('Focus', 'The free app', 'zenly,app'),
        [],
        ['zenly'],
      ),
    ).toEqual([]);
  });

  it('never reports a title word as unused', () => {
    expect(
      draftWastedWords(
        Store.APP_STORE,
        appStoreFields('Zenly Timer', ''),
        [],
        [],
      ),
    ).toEqual([]);
  });

  it('on Google Play reports only unused words of the short description', () => {
    expect(
      draftWastedWords(
        Store.GOOGLE_PLAY,
        [
          { field: 'title', value: 'Habit Tracker' },
          { field: 'shortDescription', value: 'Habit planner' },
          { field: 'description', value: 'Calendar planner' },
        ],
        ['habit tracker'],
        [],
      ),
    ).toEqual([
      { word: 'planner', reason: 'unused', fields: ['shortDescription'] },
    ]);
  });

  it('normalizes before comparing', () => {
    expect(
      draftWastedWords(
        Store.APP_STORE,
        appStoreFields('Habit', '', 'habit,'),
        ['habit'],
        [],
      ),
    ).toEqual([
      { word: 'habit', reason: 'repeated', fields: ['title', 'keywordField'] },
    ]);
  });

  it('counts a word of an unsegmented script as one run', () => {
    expect(
      draftWastedWords(
        Store.APP_STORE,
        appStoreFields('集中タイマー', '集中タイマー'),
        [],
        [],
      ),
    ).toEqual([
      {
        word: '集中タイマー',
        reason: 'repeated',
        fields: ['title', 'subtitle'],
      },
    ]);
  });

  it('lists repeated words first, each group in first appearance order', () => {
    expect(
      draftWastedWords(
        Store.APP_STORE,
        appStoreFields('Habit Tracker', 'Planner goals', 'tracker,habit,zen'),
        [],
        [],
      ).map(({ word, reason }) => [word, reason]),
    ).toEqual([
      ['habit', 'repeated'],
      ['tracker', 'repeated'],
      ['planner', 'unused'],
      ['goals', 'unused'],
      ['zen', 'unused'],
    ]);
  });
});
