import { interleaveDistinct } from './interleave';

describe('interleaveDistinct', () => {
  it('takes one item from each list in turn', () => {
    expect(
      interleaveDistinct(
        [
          ['a', 'b', 'c'],
          ['x', 'y'],
        ],
        10,
      ),
    ).toEqual(['a', 'x', 'b', 'y', 'c']);
  });

  it('stops at the limit', () => {
    expect(
      interleaveDistinct(
        [
          ['a', 'b'],
          ['x', 'y'],
        ],
        3,
      ),
    ).toEqual(['a', 'x', 'b']);
  });

  it('keeps the first occurrence of a repeated item', () => {
    expect(
      interleaveDistinct(
        [
          ['quiz', 'mapa'],
          ['quiz', 'map'],
        ],
        10,
      ),
    ).toEqual(['quiz', 'mapa', 'map']);
  });

  it('compares items by the key it is given', () => {
    expect(
      interleaveDistinct(
        [[{ text: 'quiz' }], [{ text: 'quiz' }]],
        10,
        (item) => item.text,
      ),
    ).toEqual([{ text: 'quiz' }]);
  });

  it('returns one list unchanged up to the limit', () => {
    expect(interleaveDistinct([['a', 'b', 'c']], 2)).toEqual(['a', 'b']);
  });

  it('handles no lists and empty lists', () => {
    expect(interleaveDistinct([], 5)).toEqual([]);
    expect(interleaveDistinct([[], ['a']], 5)).toEqual(['a']);
  });
});
