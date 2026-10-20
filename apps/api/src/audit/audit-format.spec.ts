import { formatCount, formatStars } from './audit-format';

describe('formatCount', () => {
  it.each([
    [0, '0'],
    [341, '341'],
    [1000, '1,000'],
    [30853, '30,853'],
    [17322322, '17,322,322'],
    [328427.5, '328,427.5'],
  ])('writes %s as %s', (value, text) => {
    expect(formatCount(value)).toBe(text);
  });
});

describe('formatStars', () => {
  it.each([
    [4.68104, '4.68'],
    [4.5, '4.50'],
    [5, '5.00'],
  ])('writes %s as %s', (value, text) => {
    expect(formatStars(value)).toBe(text);
  });
});
