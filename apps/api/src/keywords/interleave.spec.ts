import { interleave } from './interleave';

describe('interleave', () => {
  it('takes one item from each list in turn', () => {
    expect(
      interleave(
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
      interleave(
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
      interleave(
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
      interleave(
        [[{ text: 'quiz' }], [{ text: 'quiz' }]],
        10,
        (item) => item.text,
      ),
    ).toEqual([{ text: 'quiz' }]);
  });

  it('returns one list unchanged up to the limit', () => {
    expect(interleave([['a', 'b', 'c']], 2)).toEqual(['a', 'b']);
  });

  it('handles no lists and empty lists', () => {
    expect(interleave([], 5)).toEqual([]);
    expect(interleave([[], ['a']], 5)).toEqual(['a']);
  });
});
