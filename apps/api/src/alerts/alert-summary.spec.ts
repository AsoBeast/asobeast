import { position, rank } from './alert-summary';

describe('position', () => {
  it.each([
    [1, undefined, '#1'],
    [200, undefined, '#200'],
    [0, undefined, 'outside top 200'],
    [-1, undefined, 'outside top 200'],
    [null, undefined, 'outside top 200'],
    [null, 100, 'outside top 100'],
    [0, 100, 'outside top 100'],
  ])('renders %s at depth %s as %s', (value, depth, expected) => {
    expect(position(value, depth)).toBe(expected);
  });
});

describe('rank', () => {
  it.each([
    [3, undefined, '3'],
    [0, undefined, '>200'],
    [-1, 100, '>100'],
    [null, 100, '>100'],
  ])('renders %s at depth %s as %s', (value, depth, expected) => {
    expect(rank(value, depth)).toBe(expected);
  });
});
