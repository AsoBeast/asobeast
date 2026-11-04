import { overlappingTerms } from './popularity-terms';

const ENGLISH = ['en'];

describe('overlappingTerms', () => {
  it('keeps a term that shares a usable word with the listing', () => {
    expect(
      overlappingTerms(
        [{ term: 'habit streak', popularity: 40 }],
        ['Habit Tracker'],
        ENGLISH,
      ),
    ).toEqual([{ term: 'habit streak', popularity: 40 }]);
  });

  it('drops a term whose only shared word is a function word', () => {
    expect(
      overlappingTerms(
        [{ term: 'the best', popularity: 70 }],
        ['The Habit Tracker'],
        ENGLISH,
      ),
    ).toEqual([]);
  });

  it('drops a term that shares nothing with the listing', () => {
    expect(
      overlappingTerms(
        [{ term: 'photo editor', popularity: 70 }],
        ['Habit Tracker'],
        ENGLISH,
      ),
    ).toEqual([]);
  });

  it('orders by popularity, then by term', () => {
    expect(
      overlappingTerms(
        [
          { term: 'tracker app', popularity: 30 },
          { term: 'habit streak', popularity: 50 },
          { term: 'daily habit', popularity: 50 },
        ],
        ['Habit Tracker'],
        ENGLISH,
      ).map(({ term }) => term),
    ).toEqual(['daily habit', 'habit streak', 'tracker app']);
  });

  it('matches a spaceless script word through its tokens', () => {
    expect(
      overlappingTerms(
        [{ term: 'タイマー', popularity: 20 }],
        ['タイマー', '集中する'],
        ['ja'],
      ),
    ).toEqual([{ term: 'タイマー', popularity: 20 }]);
  });
});
